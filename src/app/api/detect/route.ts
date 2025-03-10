import { NextResponse } from "next/server";
import fetch from "node-fetch";
import FormData from "form-data";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = new URL(req.url).searchParams.get("type");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Convert File to ArrayBuffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create form-data using the imported FormData
    const formDataForPython = new FormData();
    formDataForPython.append("file", buffer, {
      filename: file.name,
      contentType: file.type,
    });
    formDataForPython.append("type", type || "");

    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8001/detect";
    
    const response = await fetch(pythonBackendUrl, {
      method: "POST",
      body: formDataForPython as any,
      headers: formDataForPython.getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Backend responded with status: ${response.status}. ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        details: errorMessage 
      }, 
      { status: 500 }
    );
  }
}
