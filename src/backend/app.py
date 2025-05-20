from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from ultralytics import YOLO
import logging
import base64
from io import BytesIO
import os
from typing import List, Dict
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    object_model = YOLO("/Users/komangyudasaputra/Documents/development/tugas_akhir/dog-breeds-detection/src/backend/object-det/best.pt")
    segmentation_model = YOLO("/Users/komangyudasaputra/Documents/development/tugas_akhir/dog-breeds-detection/src/backend/instance-seg/best.pt")
except Exception as e:
    logger.error(f"Error loading models: {e}")
    raise

@app.post("/detect")
async def detect(file: UploadFile = File(...), type: str = Form(...)):
    try:

        logger.info(f"Received detection request - Type: {type}, Filename: {file.filename}")
        
        # Read image
        image_bytes = await file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(status_code=400, detail="Could not decode image")


        CONF_THRESHOLD = 0.65

        if type == "object":
            results = object_model(image, conf=CONF_THRESHOLD)  
            speed = results[0].speed
        elif type == "segmentation":
            results = segmentation_model(image, conf=CONF_THRESHOLD) 
            speed = results[0].speed
        else:
            raise HTTPException(status_code=400, detail="Invalid detection type")

        detections = []
        for result in results:
            im_array = result.plot(conf=CONF_THRESHOLD, boxes=True, masks=True)
            
            for i, box in enumerate(result.boxes):
                x1, y1, x2, y2 = box.xyxy[0].tolist() #mengambil kordinat bounding box
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
                
                if type == "segmentation" and hasattr(result, 'masks') and len(result.masks) > i:
                    mask = result.masks[i]
                    if hasattr(mask, 'xy'): 
                        detection["segments"] = [
                            [float(x) for x in point] 
                            for point in mask.xy[0].tolist() #mengambil kordinat mask
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
                "preprocess": float(speed.get('preprocess', 0)), #lamanya proses gambar diubah (resize dll)
                "inference": float(speed.get('inference', 0)), #lamanya proses mendeteksi objek oleh model
                "postprocess": float(speed.get('postprocess', 0)) #mengambil hasil akhir(kelas, kordinat, dll)
            }
        }

    except Exception as e:
        logger.error(f"Error during detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch-test")
async def batch_test(type: str = Form(...)):
    try:
        logger.info(f"Received batch test request - Type: {type}")
        

        if type == "object":
            test_path = "/Users/komangyudasaputra/Documents/development/tugas_akhir/dog-breeds-detection/src/app/test_dataset/object_det/test/images"
            model = object_model
        elif type == "segmentation":
            test_path = "/Users/komangyudasaputra/Documents/development/tugas_akhir/dog-breeds-detection/src/app/test_dataset/instance_seg/test/images"
            model = segmentation_model
        else:
            raise HTTPException(status_code=400, detail="Invalid detection type")

        image_files = [f for f in os.listdir(test_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        
        results = []
        total_inference_time = 0
        
        for image_file in image_files:
            image_path = os.path.join(test_path, image_file)
            image = cv2.imread(image_path)
            
            if image is None:
                logger.warning(f"Could not read image: {image_file}")
                continue

            #  detection
            start_time = time.time()
            results_model = model(image, conf=0.65)
            inference_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            total_inference_time += inference_time

            # Process results
            result = results_model[0]
            im_array = result.plot(conf=0.65, boxes=True, masks=True)
            
            # Convert result image to base64
            _, buffer = cv2.imencode('.jpg', im_array)
            img_base64 = base64.b64encode(buffer).decode('utf-8')

            # Get detections
            detections = []
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
                
                if type == "segmentation" and hasattr(result, 'masks') and len(result.masks) > i:
                    mask = result.masks[i]
                    if hasattr(mask, 'xy'):
                        detection["segments"] = [
                            [float(x) for x in point]
                            for point in mask.xy[0].tolist()
                        ]
                
                detections.append(detection)

            results.append({
                "filename": image_file,
                "image": img_base64,
                "detections": detections,
                "inference_time": round(inference_time, 2)
            })

        avg_inference_time = total_inference_time / len(results) if results else 0

        return {
            "success": True,
            "results": results,
            "average_inference_time": round(avg_inference_time, 2),
            "total_images": len(results)
        }

    except Exception as e:
        logger.error(f"Error during batch testing: {e}")
        raise HTTPException(status_code=500, detail=str(e))
