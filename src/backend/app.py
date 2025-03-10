from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from ultralytics import YOLO
import logging
import base64
from io import BytesIO

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models
try:
    object_model = YOLO("/Users/komangyudasaputra/Documents/development/tugas_akhir/dog-breeds-detection/src/backend/object-det/best.pt")
    segmentation_model = YOLO("/Users/komangyudasaputra/Documents/development/tugas_akhir/dog-breeds-detection/src/backend/instance-seg/best.pt")
except Exception as e:
    logger.error(f"Error loading models: {e}")
    raise

@app.post("/detect")
async def detect(file: UploadFile = File(...), type: str = Form(...)):
    try:
        # Log request info
        logger.info(f"Received detection request - Type: {type}, Filename: {file.filename}")
        
        # Read image
        image_bytes = await file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(status_code=400, detail="Could not decode image")

        # Set confidence threshold
        CONF_THRESHOLD = 0.55

        # Select model and process image with confidence threshold
        if type == "object":
            results = object_model(image, conf=CONF_THRESHOLD)  # Set confidence threshold for prediction
            speed = results[0].speed
        elif type == "segmentation":
            results = segmentation_model(image, conf=CONF_THRESHOLD)  # Set confidence threshold for prediction
            speed = results[0].speed
        else:
            raise HTTPException(status_code=400, detail="Invalid detection type")

        # Process results and draw visualizations
        detections = []
        for result in results:
            # Plot with same confidence threshold
            im_array = result.plot(conf=CONF_THRESHOLD, boxes=True, masks=True)
            
            # Process boxes and segments (no need to check confidence here as it's already filtered)
            for i, box in enumerate(result.boxes):
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = box.conf[0].item()
                cls = int(box.cls[0].item())
                class_name = result.names[cls]
                
                detection = {
                    "x1": float(x1),
                    "y1": float(y1),
                    "x2": float(x2),
                    "y2": float(y2),
                    "confidence": float(round(conf, 2)),
                    "class": class_name
                }
                
                # Add segmentation mask points if available
                if type == "segmentation" and hasattr(result, 'masks') and len(result.masks) > i:
                    mask = result.masks[i]
                    if hasattr(mask, 'xy'):
                        detection["segments"] = [
                            [float(x) for x in point] 
                            for point in mask.xy[0].tolist()
                        ]

                detections.append(detection)

        # Convert the result image to base64
        _, buffer = cv2.imencode('.jpg', im_array)
        img_base64 = base64.b64encode(buffer).decode('utf-8')

        logger.info(f"Detection completed - Found {len(detections)} objects with confidence >= {CONF_THRESHOLD}")
        return {
            "success": True,
            "detections": detections,
            "count": len(detections),
            "image": img_base64,
            "type": type,
            "speed": {
                "preprocess": float(speed.get('preprocess', 0)),
                "inference": float(speed.get('inference', 0)),
                "postprocess": float(speed.get('postprocess', 0))
            }
        }

    except Exception as e:
        logger.error(f"Error during detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))
