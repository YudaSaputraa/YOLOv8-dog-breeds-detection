"use client";
import { useState } from "react";
import Image from "next/image";

interface Detection {
  class: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  segments?: number[][];
}

interface Speed {
  preprocess: number;
  inference: number;
  postprocess: number;
}

interface DetectionResult {
  image: string;
  detections: Detection[];
  speed?: Speed;
}

export default function Home() {
  const [objectImage, setObjectImage] = useState<File | null>(null);
  const [segmentationImage, setSegmentationImage] = useState<File | null>(null);
  const [objectPreview, setObjectPreview] = useState<string | null>(null);
  const [segmentationPreview, setSegmentationPreview] = useState<string | null>(null);
  const [objectResult, setObjectResult] = useState<DetectionResult | null>(null);
  const [segmentationResult, setSegmentationResult] = useState<DetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: React.Dispatch<React.SetStateAction<File | null>>,
    setPreview: React.Dispatch<React.SetStateAction<string | null>>,
    setResult: React.Dispatch<React.SetStateAction<DetectionResult | null>>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null); // Clear previous results
    }
  };

  const handleDetect = async (type: "object" | "segmentation") => {
    const image = type === "object" ? objectImage : segmentationImage;
    if (!image) return alert("Please upload an image first");

    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", image);

    try {
      const res = await fetch(`/api/detect?type=${type}`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.error) {
        alert(`Error: ${data.error}`);
        return;
      }

      const result = {
        image: `data:image/jpeg;base64,${data.image}`,
        detections: data.detections,
        speed: data.speed || {  // Add default values if speed is undefined
          preprocess: 0,
          inference: 0,
          postprocess: 0
        }
      };

      if (type === "object") {
        setObjectResult(result);
      } else {
        setSegmentationResult(result);
      }

    } catch (err) {
      console.error("Error detecting:", err);
      alert("Error during detection. Please check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderDetectionDetails = (detection: Detection) => {
    return (
      <div className="mb-2">
        <span className="font-medium">{detection.class}</span>
        <span className="text-gray-600">
          {' '}(Confidence: {Math.round(detection.confidence * 100)}%)
        </span>
        {detection.segments && (
          <span className="text-sm text-gray-500"> - Segmented</span>
        )}
      </div>
    );
  };

  const renderSpeed = (speed?: Speed) => {
    if (!speed) return null;
    
    const total = speed.preprocess + speed.inference + speed.postprocess;
    return (
      <div className="text-sm text-gray-600 mt-2 space-y-1">
        <div>Detection Speed:</div>
        <div className="grid grid-cols-2 gap-x-4 pl-2">
          <span>Preprocess:</span>
          <span>{speed.preprocess.toFixed(1)}ms</span>
          <span>Inference:</span>
          <span>{speed.inference.toFixed(1)}ms</span>
          <span>Postprocess:</span>
          <span>{speed.postprocess.toFixed(1)}ms</span>
          <span className="font-medium">Total:</span>
          <span className="font-medium">{total.toFixed(1)}ms</span>
        </div>
      </div>
    );
  };

  const renderResults = (result: DetectionResult | null) => {
    if (!result) return null;
    
    return (
      <div className="mt-4 w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Image 
              src={result.image} 
              alt="Detection Result" 
              width={300} 
              height={300} 
              className="rounded shadow"
              unoptimized
            />
          </div>
          <div className="w-full p-4 rounded">
            <h3 className="font-semibold mb-2">
              Detected Objects ({result.detections.length}):
            </h3>
            <div className="space-y-2">
              {result.detections.map((det, idx) => (
                <div key={idx} className="pl-4 border-l-2 border-blue-500">
                  {renderDetectionDetails(det)}
                </div>
              ))}
            </div>
            {result.speed && renderSpeed(result.speed)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">YOLOv8 Object Detection & Instance Segmentation</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Object Detection Input */}
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-lg font-semibold">Object Detection</h2>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => handleImageUpload(e, setObjectImage, setObjectPreview, setObjectResult)} 
          />
          {objectPreview && (
            <Image 
              src={objectPreview} 
              alt="Object Detection Preview" 
              width={300} 
              height={300} 
              className="rounded shadow" 
            />
          )}
          <button 
            onClick={() => handleDetect("object")} 
            disabled={isLoading || !objectImage}
            className={`px-6 py-2 bg-blue-600 text-white rounded shadow ${
              (isLoading || !objectImage) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Processing...' : 'Detect Object'}
          </button>
          {renderResults(objectResult)}
        </div>

        {/* Instance Segmentation Input */}
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-lg font-semibold">Instance Segmentation</h2>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => handleImageUpload(e, setSegmentationImage, setSegmentationPreview, setSegmentationResult)} 
          />
          {segmentationPreview && (
            <Image 
              src={segmentationPreview} 
              alt="Instance Segmentation Preview" 
              width={300} 
              height={300} 
              className="rounded shadow" 
            />
          )}
          <button 
            onClick={() => handleDetect("segmentation")} 
            disabled={isLoading || !segmentationImage}
            className={`px-6 py-2 bg-green-600 text-white rounded shadow ${
              (isLoading || !segmentationImage) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Processing...' : 'Detect Segmentation'}
          </button>
          {renderResults(segmentationResult)}
        </div>
      </div>
    </div>
  );
}
