import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Alert,
  ScrollView,
  ActivityIndicator,
  ImageBackground
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useDatabase } from '@/database/DatabaseContext';
import { router } from 'expo-router';
import { area } from '@turf/area';
import { polygon } from '@turf/helpers';

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F5F7F6; }
    .map-toggle {
      position: absolute; top: 10px; right: 10px; z-index: 1000;
      background: white; padding: 6px 12px; border-radius: 20px;
      font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px; color: #1B4322; border: 1px solid #E1E7E3;
      box-shadow: 0 2px 5px rgba(0,0,0,0.15); cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="map-toggle" id="toggle-layer">🛰️ Satellite View</div>
  <script>
    const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    
    const satelliteLayer = L.tileLayer(satelliteUrl, { maxZoom: 19, attribution: 'Esri &copy; contributors' });
    const streetLayer = L.tileLayer(streetUrl, { maxZoom: 19, attribution: 'OSM &copy; contributors' });
    
    // Default to Esri Satellite Imagery
    const map = L.map('map', { layers: [satelliteLayer], zoomControl: false }).setView([42.360, -71.058], 15);
    L.control.zoom({ position: 'topleft' }).addTo(map);

    let isSatellite = true;
    document.getElementById('toggle-layer').addEventListener('click', () => {
      if (isSatellite) {
        map.removeLayer(satelliteLayer);
        streetLayer.addTo(map);
        document.getElementById('toggle-layer').innerText = '🗺️ Maps View';
      } else {
        map.removeLayer(streetLayer);
        satelliteLayer.addTo(map);
        document.getElementById('toggle-layer').innerText = '🛰️ Satellite View';
      }
      isSatellite = !isSatellite;
    });

    let markers = [];
    let polygon = null;

    // Listen for coordinate clicks and post to parent app
    map.on('click', function(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      const payload = JSON.stringify({ type: 'ADD_VERTEX', latitude: lat, longitude: lng });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(payload);
      } else {
        window.parent.postMessage(payload, '*');
      }
    });

    // Listen for messages injected from React Native to draw/update the path
    window.addEventListener('message', function(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'UPDATE_PATH') {
          // Clear old markers and polygon
          markers.forEach(m => map.removeLayer(m));
          markers = [];
          if (polygon) map.removeLayer(polygon);

          const coords = data.vertices;
          if (coords.length > 0) {
            // Draw new markers
            coords.forEach((c, idx) => {
              const marker = L.marker([c.latitude, c.longitude], {
                icon: L.divIcon({
                  html: '<div style="background-color: ' + (idx === 0 ? '#E65100' : '#2E7D32') + '; color: white; width: 20px; height: 20px; border-radius: 10px; border: 2px solid white; display: flex; justify-content: center; align-items: center; font-size: 9px; font-weight: bold; font-family: sans-serif;">' + (idx + 1) + '</div>',
                  className: '',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })
              }).addTo(map);
              markers.push(marker);
            });

            // Center map on last added vertex
            const last = coords[coords.length - 1];
            map.setView([last.latitude, last.longitude], map.getZoom());

            // Draw line/polygon
            const points = coords.map(c => [c.latitude, c.longitude]);
            if (data.isShapeCompleted) {
              points.push([coords[0].latitude, coords[0].longitude]);
              polygon = L.polygon(points, { color: '#2E7D32', fillColor: '#2E7D32', fillOpacity: 0.2 }).addTo(map);
            } else {
              polygon = L.polyline(points, { color: '#2E7D32' }).addTo(map);
            }
          }
        }
        else if (data.type === 'SET_CENTER') {
          map.setView([data.latitude, data.longitude], 16);
        }
      } catch (err) {
        console.error("Leaflet received invalid message:", err);
      }
    });
  </script>
</body>
</html>
`;

interface FieldSector {
  id: string;
  name: string;
  crop: string;
  moisture: string;
  status: 'optimal' | 'dry' | 'wet';
  color: string;
  sizeAcres: number;
}

export default function ExploreScreen() {
  const { db, setPendingAreaCalculation, isOnline } = useDatabase();
  const [selectedSector, setSelectedSector] = useState<FieldSector | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
  const webviewRef = useRef<WebView>(null);
  
  // Drawing states
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(true);
  const [vertices, setVertices] = useState<{ x: number; y: number; latitude: number; longitude: number }[]>([]);
  const [isShapeCompleted, setIsShapeCompleted] = useState<boolean>(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 320, height: 320 });

  const watchIdRef = useRef<number | null>(null);
  const [isGpsTracking, setIsGpsTracking] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Handle WebView messages (ADD_VERTEX) from Leaflet map
  const handleWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ADD_VERTEX') {
        const { latitude, longitude } = message;
        // Mock X/Y representation for fallback vector grid layout
        const x = canvasDimensions.width / 2;
        const y = canvasDimensions.height / 2;

        setVertices(prev => {
          if (isShapeCompleted) return prev;
          return [...prev, { x, y, latitude, longitude }];
        });
      }
    } catch (err) {
      console.error('WebView message parsing error:', err);
    }
  };

  // Sync React Native vertices state to Leaflet map WebView
  useEffect(() => {
    if (isOnline && webviewRef.current && vertices.length > 0) {
      const payload = JSON.stringify({ 
        type: 'UPDATE_PATH', 
        vertices: vertices, 
        isShapeCompleted: isShapeCompleted 
      });
      const script = `if (webviewRef && webviewRef.current) { webviewRef.current.postMessage(${JSON.stringify(payload)}, "*"); } window.postMessage(${JSON.stringify(payload)}, "*"); true;`;
      webviewRef.current.injectJavaScript(script);
    }
  }, [vertices, isShapeCompleted, isOnline]);

  const sectors: FieldSector[] = [
    { id: '1', name: 'Sector 1: West Vineyard', crop: 'Grapes (Cabernet)', moisture: '18%', status: 'dry', color: '#5B3E84', sizeAcres: 4.5 },
    { id: '2', name: 'Sector 2: North Cornfield', crop: 'Sweet Corn', moisture: '32%', status: 'optimal', color: '#E0A92E', sizeAcres: 12.0 },
    { id: '3', name: 'Sector 3: Main Barn & HQ', crop: 'Infrastructure', moisture: 'N/A', status: 'optimal', color: '#A03030', sizeAcres: 1.2 },
    { id: '4', name: 'Sector 4: South Orchard', crop: 'Honeycrisp Apples', moisture: '45%', status: 'wet', color: '#2E7D32', sizeAcres: 8.8 }
  ];

  useEffect(() => {
    // Simulate loading satellite imagery
    const timer = setTimeout(() => {
      setIsMapLoaded(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasDimensions({ width, height });
    }
  };

  // Dynamic coordinate projection to auto-scale viewport for GPS mapping
  const getRenderCoordinates = () => {
    if (vertices.length === 0) return [];
    
    // Determine if vertices contain real GPS coordinates (different from mock Boston ones)
    const first = vertices[0];
    const isRealGps = Math.abs(first.latitude - 42.36) > 0.5 || Math.abs(first.longitude - (-71.06)) > 0.5;

    if (!isRealGps) {
      // Boston mock coordinates: keep coordinates exactly as mapped
      return vertices;
    }

    // Dynamic scale algorithm to fit real-world GPS walks anywhere on Earth
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    vertices.forEach(v => {
      if (v.latitude < minLat) minLat = v.latitude;
      if (v.latitude > maxLat) maxLat = v.latitude;
      if (v.longitude < minLng) minLng = v.longitude;
      if (v.longitude > maxLng) maxLng = v.longitude;
    });

    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    
    // Add 15% margins for pleasant padding
    const paddingLat = latRange > 0 ? latRange * 0.15 : 0.0001;
    const paddingLng = lngRange > 0 ? lngRange * 0.15 : 0.00015;

    const bounds = {
      minLat: minLat - paddingLat,
      maxLat: maxLat + paddingLat,
      minLng: minLng - paddingLng,
      maxLng: maxLng + paddingLng
    };

    const rangeLat = bounds.maxLat - bounds.minLat;
    const rangeLng = bounds.maxLng - bounds.minLng;

    return vertices.map(v => {
      const x = ((v.longitude - bounds.minLng) / rangeLng) * canvasDimensions.width;
      const y = ((bounds.maxLat - v.latitude) / rangeLat) * canvasDimensions.height;
      return { ...v, x, y };
    });
  };

  const renderedVertices = getRenderCoordinates();

  const toggleGpsTracking = () => {
    if (isGpsTracking) {
      setIsGpsTracking(false);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    } else {
      setIsGpsTracking(true);
      setIsDrawingMode(true);
      setIsShapeCompleted(false);
      setVertices([]);

      if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setVertices(prev => {
              if (prev.length > 0) {
                const last = prev[prev.length - 1];
                const latDiff = Math.abs(last.latitude - latitude);
                const lngDiff = Math.abs(last.longitude - longitude);
                // ~2 meter threshold to filter out tiny drift
                if (latDiff < 0.00002 && lngDiff < 0.00002) return prev;
              }
              return [...prev, { x: 0, y: 0, latitude, longitude }];
            });
          },
          (err) => {
            console.warn('Geolocation failed, simulating walk path:', err);
            runGpsSimulation();
          },
          { enableHighAccuracy: true }
        );
        watchIdRef.current = watchId;
      } else {
        runGpsSimulation();
      }
    }
  };

  const runGpsSimulation = () => {
    let step = 0;
    const interval = setInterval(() => {
      setIsGpsTracking(active => {
        if (!active) {
          clearInterval(interval);
          return false;
        }
        
        const centerLat = 42.360;
        const centerLng = -71.058;
        const radiusLat = 0.001;
        const radiusLng = 0.0015;

        if (step >= 8) {
          clearInterval(interval);
          setIsShapeCompleted(true);
          return false;
        }

        const angle = (step / 8) * 2 * Math.PI;
        const latitude = centerLat + Math.cos(angle) * radiusLat;
        const longitude = centerLng + Math.sin(angle) * radiusLng;

        const x = ((longitude - (-71.062)) / 0.007) * canvasDimensions.width;
        const y = ((42.362 - latitude) / 0.004) * canvasDimensions.height;

        setVertices(prev => [...prev, { x, y, latitude, longitude }]);
        step++;
        return true;
      });
    }, 1500);
  };

  // Calculate area from vertices using Turf.js
  const calculateAreaInfo = () => {
    if (vertices.length < 3) return { acres: 0, sqft: 0 };
    try {
      // Turf expects coordinates in [longitude, latitude] format
      const coords = vertices.map(v => [v.longitude, v.latitude]);
      // Close the polygon path
      coords.push([vertices[0].longitude, vertices[0].latitude]);
      
      const poly = polygon([coords]);
      const areaInSqMeters = area(poly);
      
      const acres = parseFloat((areaInSqMeters / 4046.86).toFixed(3));
      const sqft = Math.round(areaInSqMeters * 10.7639);
      
      return { acres, sqft };
    } catch (err) {
      console.error('Turf area calculation error:', err);
      return { acres: 0, sqft: 0 };
    }
  };

  const areaInfo = calculateAreaInfo();

  // Handle map tap/click
  const handleMapPress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;

    if (isDrawingMode) {
      if (isShapeCompleted) {
        Alert.alert('Shape Completed', 'Click Reset Map to draw a new boundary.');
        return;
      }

      // Convert layout click pixels to mock GPS coordinates
      const longitude = -71.062 + (locationX / canvasDimensions.width) * 0.007;
      const latitude = 42.362 - (locationY / canvasDimensions.height) * 0.004;

      setVertices(prev => [...prev, { x: locationX, y: locationY, latitude, longitude }]);
    } else {
      // Sector view mode click
      Alert.alert('Sector Selector', 'Please tap a specific sector label overlay to view its details.');
    }
  };

  const handleUndo = () => {
    if (isShapeCompleted) {
      setIsShapeCompleted(false);
    }
    setVertices(prev => prev.slice(0, -1));
  };

  const handleReset = () => {
    setVertices([]);
    setIsShapeCompleted(false);
  };

  const handleCompleteShape = () => {
    if (vertices.length < 3) {
      Alert.alert('Insufficient Vertices', 'Please drop at least 3 points to define an area.');
      return;
    }
    setIsShapeCompleted(true);
  };

  const handleUseArea = () => {
    if (areaInfo.acres <= 0) return;
    setPendingAreaCalculation(areaInfo.acres);
    Alert.alert(
      'Area Saved',
      `Calculated area of ${areaInfo.acres} Acres has been saved. It will pre-fill the form on the Home screen.`,
      [
        {
          text: 'Go to Pesticide Log',
          onPress: () => router.push('/')
        }
      ]
    );
  };

  // Helper to render lines between vertices in pure React Native
  const renderLineSegment = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    key: any,
    isDotted = false
  ) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    
    return (
      <View
        key={`line-${key}`}
        style={{
          position: 'absolute',
          left: midX - distance / 2,
          top: midY - 1,
          width: distance,
          height: isDotted ? 2 : 3,
          backgroundColor: isDotted ? 'rgba(230, 81, 0, 0.5)' : '#2E7D32',
          borderStyle: isDotted ? 'dashed' : 'solid',
          borderWidth: isDotted ? 1 : 0,
          borderColor: isDotted ? '#E65100' : 'transparent',
          transform: [{ rotate: `${angle}rad` }],
          zIndex: 5
        }}
      />
    );
  };

  const renderLines = () => {
    const lines = [];
    const count = renderedVertices.length;
    
    if (count < 2) return null;
    
    // Draw solid lines connecting each point to the next
    for (let i = 0; i < count - 1; i++) {
      lines.push(renderLineSegment(renderedVertices[i], renderedVertices[i + 1], i));
    }
    
    // Connect the last point to the first
    if (isShapeCompleted && count > 2) {
      lines.push(renderLineSegment(renderedVertices[count - 1], renderedVertices[0], 'closing'));
    } else if (count > 2) {
      // Dotted closing preview line
      lines.push(renderLineSegment(renderedVertices[count - 1], renderedVertices[0], 'preview', true));
    }
    
    return lines;
  };

  return (
    <View style={styles.container}>
      {/* Map Control Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Interactive Map Grid</Text>
            <Text style={styles.headerSub}>
              {isDrawingMode 
                ? '✍️ Drawing Mode: Tap to map boundaries' 
                : '🗺️ Sector Mode: Select preset sectors'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleBtn, isDrawingMode && styles.toggleBtnActive]}
            onPress={() => {
              setIsDrawingMode(!isDrawingMode);
              setSelectedSector(null);
            }}
          >
            <Text style={styles.toggleBtnText}>
              {isDrawingMode ? '📁 View Sectors' : '📐 Draw Boundary'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Map Canvas Box */}
      <View style={styles.mapContainer}>
        {!isMapLoaded ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Loading satellite telemetry...</Text>
          </View>
        ) : isOnline ? (
          <WebView
            ref={webviewRef}
            originWhitelist={['*']}
            source={{ html: LEAFLET_HTML }}
            style={styles.mapCanvas}
            onMessage={handleWebViewMessage}
            onLoad={() => {
              if (vertices.length > 0) {
                const last = vertices[vertices.length - 1];
                const script = `window.postMessage(JSON.stringify({ type: 'SET_CENTER', latitude: ${last.latitude}, longitude: ${last.longitude} }), "*"); true;`;
                webviewRef.current?.injectJavaScript(script);
              }
            }}
          />
        ) : (
          <TouchableOpacity
            style={styles.mapCanvas}
            activeOpacity={1}
            onPress={handleMapPress}
            onLayout={handleLayout}
          >
            {/* Offline Grid representation */}
            <ImageBackground
              source={{ uri: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80' }}
              style={styles.mapBackground}
              imageStyle={styles.backgroundImage}
            >
              {/* Presets Sector overlay */}
              {!isDrawingMode && (
                <View style={styles.gridOverlay}>
                  {sectors.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.sectorZone, { backgroundColor: s.color + '33', borderColor: s.color }]}
                      onPress={() => setSelectedSector(s)}
                    >
                      <Text style={styles.sectorLabel}>{s.name.split(':')[0]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Lines drawn between vertices */}
              {isDrawingMode && renderLines()}

              {/* Numbered point markers for drawn vertices */}
              {isDrawingMode && renderedVertices.map((v, index) => (
                <View
                  key={`vertex-${index}`}
                  style={[
                    styles.vertexMarker,
                    { 
                      left: v.x - 10, 
                      top: v.y - 10,
                      backgroundColor: index === 0 ? '#E65100' : '#2E7D32'
                    }
                  ]}
                >
                  <Text style={styles.vertexText}>{index + 1}</Text>
                </View>
              ))}

              {/* Offline Watermark indicator */}
              <View style={{ position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>📡 Offline Grid Workspace Mode</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Control Drawer */}
      <View style={styles.drawer}>
        {isDrawingMode ? (
          <View style={styles.drawerContent}>
            {vertices.length === 0 ? (
              <View style={styles.drawerEmpty}>
                <Text style={styles.drawerEmptyText}>
                  Tap anywhere on the satellite image above to drop boundary points, or walk/drive the perimeter:
                </Text>
                <TouchableOpacity
                  style={[styles.gpsBtn, isGpsTracking && styles.gpsBtnActive]}
                  onPress={toggleGpsTracking}
                >
                  <Text style={styles.gpsBtnText}>
                    {isGpsTracking ? '🛑 Stop GPS Tracking' : '📍 GPS Walk/Drive Boundary'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.drawerHint}>
                  💡 Connect points in sequence to outline your treatment area.
                </Text>
              </View>
            ) : (
              <View style={styles.calcContainer}>
                <View style={styles.calcHeader}>
                  <Text style={styles.calcTitle}>Boundary Area Calculation</Text>
                  <TouchableOpacity
                    style={[styles.gpsMiniBtn, isGpsTracking && styles.gpsMiniBtnActive]}
                    onPress={toggleGpsTracking}
                  >
                    <Text style={styles.gpsMiniBtnText}>
                      {isGpsTracking ? '🛑 Stop GPS' : '📍 Start GPS'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.pointCount}>{vertices.length} Points Dropped</Text>
                </View>
                
                {vertices.length < 3 ? (
                  <Text style={styles.calcSub}>Drop at least 3 points to calculate acreage.</Text>
                ) : (
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Acreage</Text>
                      <Text style={styles.statValue}>{areaInfo.acres} ac</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Square Footage</Text>
                      <Text style={styles.statValue}>{areaInfo.sqft.toLocaleString()} sq ft</Text>
                    </View>
                  </View>
                )}

                <View style={styles.actionRow}>
                  {vertices.length >= 3 && !isShapeCompleted && (
                    <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteShape}>
                      <Text style={styles.completeBtnText}>🔒 Complete Area</Text>
                    </TouchableOpacity>
                  )}

                  {isShapeCompleted && (
                    <TouchableOpacity style={styles.useAreaBtn} onPress={handleUseArea}>
                      <Text style={styles.useAreaBtnText}>📋 Use Area in Pesticide Log</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.undoBtn} onPress={handleUndo}>
                    <Text style={styles.undoBtnText}>↩️ Undo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                    <Text style={styles.resetBtnText}>🗑️ Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.drawerContent}>
            {selectedSector ? (
              <View>
                <Text style={styles.drawerTitle}>{selectedSector.name}</Text>
                <View style={styles.drawerRow}>
                  <Text style={styles.drawerLabel}>Target Crop:</Text>
                  <Text style={styles.drawerValue}>{selectedSector.crop}</Text>
                </View>
                <View style={styles.drawerRow}>
                  <Text style={styles.drawerLabel}>Soil Moisture:</Text>
                  <Text style={[styles.drawerValue, selectedSector.status === 'dry' && styles.textDry]}>
                    {selectedSector.moisture} ({selectedSector.status.toUpperCase()})
                  </Text>
                </View>
                <View style={styles.drawerRow}>
                  <Text style={styles.drawerLabel}>Preset Size:</Text>
                  <Text style={styles.drawerValueCode}>{selectedSector.sizeAcres} Acres</Text>
                </View>
                <TouchableOpacity 
                  style={styles.usePresetBtn} 
                  onPress={() => {
                    setPendingAreaCalculation(selectedSector.sizeAcres);
                    Alert.alert('Preset Applied', `${selectedSector.sizeAcres} Acres pre-filled in your Pesticide Log form.`);
                    router.push('/');
                  }}
                >
                  <Text style={styles.usePresetText}>📋 Use Sector Acreage in Log</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.drawerEmpty}>
                <Text style={styles.drawerEmptyText}>
                  Tap any colored sector zone on the map to load soil moisture and preset dimensions.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6'
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E1E7E3'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    color: '#1B4322',
    fontSize: 18,
    fontWeight: 'bold'
  },
  headerSub: {
    color: '#61746B',
    fontSize: 11,
    marginTop: 2
  },
  toggleBtn: {
    borderWidth: 1,
    borderColor: '#2E7D32',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF'
  },
  toggleBtnActive: {
    backgroundColor: '#E8F5E9'
  },
  toggleBtnText: {
    color: '#2E7D32',
    fontSize: 11,
    fontWeight: 'bold'
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E1E7E3',
    borderWidth: 1,
    borderColor: '#B5C2B9'
  },
  mapCanvas: {
    flex: 1,
    width: '100%',
    height: '100%'
  },
  mapBackground: {
    flex: 1,
    width: '100%',
    height: '100%'
  },
  backgroundImage: {
    opacity: 0.95
  },
  gridOverlay: {
    flex: 1,
    flexWrap: 'wrap',
    flexDirection: 'row',
    padding: 12,
    gap: 12
  },
  sectorZone: {
    width: '47%',
    height: '47%',
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sectorLabel: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 8
  },
  vertexMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3
  },
  vertexText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#61746B',
    marginTop: 12,
    fontSize: 14
  },
  drawer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#E1E7E3',
    minHeight: 180
  },
  drawerContent: {
    flex: 1
  },
  drawerTitle: {
    color: '#1B4322',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10
  },
  drawerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  drawerLabel: {
    color: '#61746B',
    fontSize: 13
  },
  drawerValue: {
    color: '#2E3A31',
    fontSize: 13,
    fontWeight: '600'
  },
  drawerValueCode: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: 'bold'
  },
  textDry: {
    color: '#E65100'
  },
  drawerEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 100
  },
  drawerEmptyText: {
    color: '#61746B',
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 8
  },
  drawerHint: {
    color: '#8C9B90',
    textAlign: 'center',
    fontSize: 11,
    fontStyle: 'italic'
  },
  calcContainer: {
    flex: 1
  },
  calcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  calcTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1B4322'
  },
  pointCount: {
    fontSize: 11,
    color: '#61746B',
    fontWeight: '600'
  },
  calcSub: {
    fontSize: 12,
    color: '#8C9B90',
    marginVertical: 10
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F5F7F6',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E1E7E3'
  },
  statLabel: {
    fontSize: 10,
    color: '#61746B',
    marginBottom: 2
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4
  },
  completeBtn: {
    flex: 2,
    backgroundColor: '#2E7D32',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12
  },
  useAreaBtn: {
    flex: 2,
    backgroundColor: '#E65100',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  useAreaBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12
  },
  undoBtn: {
    flex: 1,
    backgroundColor: '#61746B',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  undoBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12
  },
  resetBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B5C2B9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  resetBtnText: {
    color: '#2E3A31',
    fontWeight: 'bold',
    fontSize: 12
  },
  usePresetBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12
  },
  usePresetText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold'
  },
  gpsBtn: {
    backgroundColor: '#1B4322',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginVertical: 10
  },
  gpsBtnActive: {
    backgroundColor: '#C62828'
  },
  gpsBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13
  },
  gpsMiniBtn: {
    backgroundColor: '#1B4322',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  gpsMiniBtnActive: {
    backgroundColor: '#C62828'
  },
  gpsMiniBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 10
  }
});
