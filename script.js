import {
  GestureRecognizer,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";

const dom = {
    video: document.getElementById("webcam"),
    matchstick: document.getElementById("matchstick"),
    overlay: document.getElementById("overlay"),
    btnStart: document.getElementById("startButton"),
    status: document.getElementById("debug-status"),
    message: document.getElementById("celebration-message"),
    candles: document.querySelectorAll(".candle")
};

let recognizer;
let audioContext, analyser, dataArray;
let isAudioInit = false;
let candlesLit = [false, false, false];
let lastVideoTime = -1;

// Configuración de audio
const BLOW_THRESHOLD = 40; // Sensibilidad del soplido

// 1. CARGA INICIAL DE MEDIAPIPE
async function loadModel() {
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        dom.btnStart.innerText = "INICIAR";
        dom.btnStart.disabled = false;
    } catch (e) {
        dom.status.innerText = "Error cargando IA: " + e;
    }
}
loadModel();

// 2. INICIAR EXPERIENCIA (Cámara + Audio)
dom.btnStart.onclick = async () => {
    dom.btnStart.innerText = "Iniciando...";
    
    try {
        // A. Configurar Audio (Contexto debe crearse tras gesto de usuario)
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(audioStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        isAudioInit = true;

        // B. Configurar Cámara (IMPORTANTE: facingMode para móviles)
        const constraints = {
            video: {
                facingMode: "user", // Usa cámara frontal
                width: { ideal: 640 }, // Resolución ligera para rapidez
                height: { ideal: 480 }
            }
        };
        const videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        dom.video.srcObject = videoStream;
        
        // Esperar a que el video cargue datos para saber su tamaño real
        dom.video.onloadeddata = () => {
            dom.overlay.style.display = "none";
            renderLoop();
        };

    } catch (err) {
        alert("Error: Necesitas dar permisos de cámara y micrófono.\n" + err);
        dom.btnStart.innerText = "Reintentar";
    }
};

// 3. BUCLE PRINCIPAL
function renderLoop() {
    // A. Detección de Manos
    if (dom.video.currentTime!== lastVideoTime) {
        lastVideoTime = dom.video.currentTime;
        const result = recognizer.recognizeForVideo(dom.video, Date.now());

        if (result.landmarks && result.landmarks.length > 0) {
            const hand = result.landmarks;
            const fingerTip = hand[1]; // Punta del índice

            // Mapeo de coordenadas:
            // MediaPipe da 0-1. Multiplicamos por el ancho de la ventana.
            // Invertimos X (1 - x) porque el video está en espejo (CSS scaleX(-1))
            const x = (1 - fingerTip.x) * window.innerWidth;
            const y = fingerTip.y * window.innerHeight;

            moveMatchstick(x, y);
            checkCandleCollision(x, y);
        } else {
            dom.matchstick.classList.add("hidden");
        }
    }

    // B. Detección de Soplido
    if (isAudioInit && allCandlesLit()) {
        analyser.getByteFrequencyData(dataArray);
        // Promedio de volumen
        let sum = 0;
        for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
        const volume = sum / dataArray.length;

        if (volume > BLOW_THRESHOLD) {
            finishBirthday();
            return; // Detiene el bucle si terminó
        }
    }

    requestAnimationFrame(renderLoop);
}

// Mover el fósforo visualmente
function moveMatchstick(x, y) {
    dom.matchstick.classList.remove("hidden");
    // Ajustar para que el fósforo "cuelgue" del dedo
    dom.matchstick.style.left = `${x}px`;
    dom.matchstick.style.top = `${y}px`;
}

// Lógica de encendido
function checkCandleCollision(x, y) {
    dom.candles.forEach((candle, index) => {
        if (candlesLit[index]) return; // Ya encendida

        const rect = candle.getBoundingClientRect();
        // Expandir el área de detección un poco (hitbox más generoso)
        const hitX = x > rect.left - 20 && x < rect.right + 20;
        const hitY = y > rect.top - 50 && y < rect.bottom;

        if (hitX && hitY) {
            candlesLit[index] = true;
            candle.querySelector(".flame").classList.remove("hidden");
        }
    });
}

function allCandlesLit() {
    return candlesLit.every(Boolean);
}

function finishBirthday() {
    dom.candles.forEach(c => c.querySelector(".flame").classList.add("hidden"));
    dom.matchstick.classList.add("hidden");
    dom.message.classList.remove("hidden");
    
    // Confeti a pantalla completa
    var duration = 3000;
    var end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}