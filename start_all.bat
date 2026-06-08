@echo off
echo =========================================================
echo 🌾 Launching Practical Farm Tools Suite 🌾
echo =========================================================
echo.
echo [1/2] Starting Python FastAPI Sync Server in a new window...
start cmd /k "echo Starting FastAPI Sync Server on http://localhost:8000... && cd synchronization-server && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting Expo Web Client in a new window...
start cmd /k "echo Starting Expo Mobile App (Web Mode)... && cd client-mobile-app && npm run web"

echo.
echo ---------------------------------------------------------
echo 🚀 Both servers have been launched in separate windows!
echo ---------------------------------------------------------
echo 1. Wait a moment for Expo to compile. It will automatically open the app in your browser (usually at http://localhost:8081).
echo 2. Go to the Chat tab and type some messages while offline (they'll show a pending indicator: ⏱️).
echo 3. To test multi-user sync:
echo    Open a new terminal at:
echo    C:\Users\kyles\Desktop\Antigravity Music\Practical Farm Tools
echo    And run:
echo    python -m synchronization-server.simulate_client_b
echo 4. Type a message in the simulator terminal.
echo 5. Tap 'Sync Now' on the dashboard tab in your browser app.
echo    You will see the messages successfully synchronize, and the mock message from Device_B will appear in your chat log!
echo ---------------------------------------------------------
pause
