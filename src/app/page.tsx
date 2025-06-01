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

interface BatchTestResult {
  filename: string;
  image: string;
  detections: Detection[];
  inference_time: number;
}

interface BatchTestResponse {
  success: boolean;
  results: BatchTestResult[];
  average_inference_time: number;
  total_images: number;
}

export default function Home() {
  const [objectImage, setObjectImage] = useState<File | null>(null);
  const [segmentationImage, setSegmentationImage] = useState<File | null>(null);
  const [objectPreview, setObjectPreview] = useState<string | null>(null);
  const [segmentationPreview, setSegmentationPreview] = useState<string | null>(null);
  const [objectResult, setObjectResult] = useState<DetectionResult | null>(null);
  const [segmentationResult, setSegmentationResult] = useState<DetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [batchTestResults, setBatchTestResults] = useState<BatchTestResponse | null>(null);
  const [isBatchTesting, setIsBatchTesting] = useState(false);
  const [isEvalMode, setIsEvalMode] = useState(false);

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
    // Clear batch test results when starting detection
    setBatchTestResults(null);
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
        speed: data.speed || {
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

  const handleBatchTest = async (type: "object" | "segmentation") => {
    setIsBatchTesting(true);
    // Clear all detection results when starting batch test
    setObjectResult(null);
    setSegmentationResult(null);

    try {
      const formData = new FormData();
      formData.append("type", type);

      const res = await fetch("/api/batch-test", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setBatchTestResults(data);
    } catch (err) {
      console.error("Error during batch testing:", err);
      alert("Error during batch testing. Please check console for details.");
    } finally {
      setIsBatchTesting(false);
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

  const renderBatchTestResults = () => {
    if (!batchTestResults) return null;

    return (
      <div className="mt-8 w-full max-w-6xl">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800">Batch Test Results</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">No</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Image</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Filename</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Detections</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Inference Time (ms)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {batchTestResults.results.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <Image
                          src={`data:image/jpeg;base64,${result.image}`}
                          alt={result.filename}
                          width={200}
                          height={200}
                          className="rounded-lg shadow-sm object-cover"
                          unoptimized
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.filename}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        {result.detections.map((det, idx) => (
                          <div key={idx} className="text-sm text-gray-600">
                            <span className="font-medium text-gray-900">{det.class}</span>
                            <span className="text-gray-500"> ({Math.round(det.confidence * 100)}%)</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-medium">{result.inference_time}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Average Inference Time:</td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">{batchTestResults.average_inference_time} ms</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      {/* Eval Mode Toggle */}
      <div className="fixed top-4 right-4 flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-gray-100">
        <span className="text-gray-700 font-medium text-sm">Eval Mode</span>
        <button
          onClick={() => setIsEvalMode(!isEvalMode)}
          className={`
            relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-300 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${isEvalMode 
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 focus:ring-blue-500' 
              : 'bg-gradient-to-r from-gray-200 to-gray-300 focus:ring-gray-400'
            }
          `}
        >
          <span
            className={`
              inline-block h-5 w-5 transform rounded-full bg-white shadow-md
              transition-all duration-300 ease-in-out
              ${isEvalMode ? 'translate-x-7' : 'translate-x-0.5'}
              ${isEvalMode ? 'scale-100' : 'scale-90'}
            `}
          />
          <span
            className={`
              absolute inset-0 flex items-center justify-between px-1.5
              text-[10px] font-semibold transition-opacity duration-300
              ${isEvalMode ? 'opacity-0' : 'opacity-100'}
            `}
          >
            <span className="text-gray-400">OFF</span>
          </span>
          <span
            className={`
              absolute inset-0 flex items-center justify-between px-1.5
              text-[10px] font-semibold transition-opacity duration-300
              ${isEvalMode ? 'opacity-100' : 'opacity-0'}
            `}
          >
            <span className="text-white">ON</span>
          </span>
        </button>
      </div>

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
          {isEvalMode && (
            <button 
              onClick={() => handleBatchTest("object")} 
              disabled={isBatchTesting}
              className={`px-6 py-2 bg-blue-400 text-white rounded shadow ${
                isBatchTesting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isBatchTesting ? 'Testing...' : 'Inference Test'}
            </button>
          )}
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
          {isEvalMode && (
            <button 
              onClick={() => handleBatchTest("segmentation")} 
              disabled={isBatchTesting}
              className={`px-6 py-2 bg-green-400 text-white rounded shadow ${
                isBatchTesting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isBatchTesting ? 'Testing...' : 'Inference Test'}
            </button>
          )}
          {renderResults(segmentationResult)}
        </div>
      </div>
      {renderBatchTestResults()}
    </div>
  );
}
