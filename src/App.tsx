// src/App.tsx

import { useState, useEffect, useRef } from 'react';
import './App.css';
import Split from 'react-split';
import UploadButton from './components/UploadButton';
import CanvasViewer, { type PixelInfo } from './components/CanvasViewer';
import MappedCanvasViewer from './components/MappedCanvasViewer';
import * as UPNG from 'upng-js';

function App() {
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [textureImage, setTextureImage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const canvasMapRef = useRef<HTMLCanvasElement | null>(null);
  const canvasTextureRef = useRef<HTMLCanvasElement | null>(null);

  const [mapHoverInfo, setMapHoverInfo] = useState<PixelInfo | null>(null);
  const [textureHoverInfo, setTextureHoverInfo] = useState<PixelInfo | null>(null);

  const [edits, setEdits] = useState<Map<string, {r: number, g: number, b: number, a: number}>>(new Map<string, {r: number, g: number, b: number, a: number}>());
  const addEdit = (pixelInfo: PixelInfo) => {
    let color = {r: pixelInfo.r, g: pixelInfo.g, b: pixelInfo.b, a: pixelInfo.a}
    let newEdits = new Map<string, {r: number, g: number, b: number, a: number}>(edits);
    newEdits.set(`${pixelInfo.x},${pixelInfo.y}`, color);
    setEdits(newEdits);
  };

  // const formatHoverInfo = (label: string, info: { x: number; y: number; r: number; g: number; b: number; a: number; selected: boolean } | null) => {
  //   return info
  //     ? `${label}: (${info.x}, ${info.y}) RGBA(${info.r}, ${info.g}, ${info.b}, ${info.a}) ${info.selected}`
  //     : null;
  // };

  useEffect(() => {
    if (mapImage && canvasMapRef.current) {
      const ctx = canvasMapRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, canvasMapRef.current!.width, canvasMapRef.current!.height);
          ctx.drawImage(img, 0, 0, canvasMapRef.current!.width, canvasMapRef.current!.height);
        };
        img.src = mapImage;
      }
    }
  }, [mapImage]);

  useEffect(() => {
    if (textureImage && canvasTextureRef.current) {
      const ctx = canvasTextureRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, canvasTextureRef.current!.width, canvasTextureRef.current!.height);
          ctx.drawImage(img, 0, 0, canvasTextureRef.current!.width, canvasTextureRef.current!.height);
        };
        img.src = textureImage;
      }
    }
  }, [textureImage]);

  const downloadMap = async () => {
    if (!mapImage) return;

    // 1. Fetch original PNG as ArrayBuffer
    const buffer = await fetch(mapImage).then((res) => res.arrayBuffer());

    // 2. Decode PNG using UPNG
    const img = UPNG.decode(buffer);
    const { width, height } = img;
    const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]); // Get RGBA buffer

    // 3. Apply pixel changes
    for (const [key, color] of edits.entries()) {
      const [xStr, yStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;

      const i = (y * width + x) * 4;
      rgba[i + 0] = color.r;
      rgba[i + 1] = color.g;
      rgba[i + 2] = color.b;
      rgba[i + 3] = color.a;
    }

    // 4. Encode the modified image
    const newPng = UPNG.encode([rgba.buffer], width, height, 0); // 0 = lossless

    // 5. Trigger download
    const blob = new Blob([newPng], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited-map.png';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Top Row */}
      <div className="flex h-[10%]">
        <div className="w-2/3 bg-red-200 flex items-start justify-start p-4 gap-4 text-xl">
          {/* Map Upload + Preview */}
          <div className="flex items-center gap-2">
            <UploadButton
              label="Upload Map PNG"
              onUpload={(data, name) => {
                setMapImage(data);
                console.log('Map uploaded:', name);
              }}
            />
            {mapImage && (
              <img src={mapImage} alt="Map preview" className="h-16 rounded border border-gray-300" />
            )}
          </div>

          {/* Texture Upload + Preview */}
          <div className="flex items-center gap-2">
            <UploadButton
              label="Upload Texture PNG"
              onUpload={(data, name) => {
                setTextureImage(data);
                console.log('Texture uploaded:', name);
              }}
            />
            {textureImage && (
              <img src={textureImage} alt="Texture preview" className="h-16 rounded border border-gray-300" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer px-4 py-2 m-2 border border-gray-400 rounded hover:bg-gray-100">
              Download Map
              <button onClick={downloadMap}></button>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer px-4 py-2 m-2 border border-gray-400 rounded hover:bg-gray-100">
              Help
              <button onClick={() => setShowHelp(true)}></button>
            </label>
          </div>
        </div>

        <div className="w-1/3 bg-blue-200 flex flex-col items-start justify-start p-4 text-xl font-mono whitespace-pre overflow-hidden">
          {mapHoverInfo && <div>
            MAP: {`(${mapHoverInfo.x}, ${mapHoverInfo.y}) RGBA(${mapHoverInfo.r}, ${mapHoverInfo.g}, ${mapHoverInfo.b}, ${mapHoverInfo.a}) ${mapHoverInfo.selected}`}
          </div>}
          {textureHoverInfo && <div>
            TEXTURE: {`(${textureHoverInfo.x}, ${textureHoverInfo.y}) RGBA(${textureHoverInfo.r}, ${textureHoverInfo.g}, ${textureHoverInfo.b}, ${textureHoverInfo.a}) ${textureHoverInfo.selected}`}
          </div>}
        </div>
      </div>

      {/* Bottom Resizable Row */}
      <div className="h-[90%]">
        <Split
          className="flex h-full"
          sizes={[33, 34, 33]}
          minSize={50}
          gutterSize={8}
        >
          <div className="bg-green-200 flex items-center justify-center overflow-hidden relative h-full w-full">
            <CanvasViewer
              canvasId={"map_canvas"}
              imageSrc={mapImage}
              onHoverPixel={(info) => setMapHoverInfo(info)}
              texturePixel={textureHoverInfo}
              setEditIndex={(edit: PixelInfo) => addEdit(edit)}
            />
          </div>
          <div className="bg-yellow-200 flex items-center justify-center overflow-hidden relative h-full w-full">
            <CanvasViewer
              canvasId={"texture_canvas"}
              imageSrc={textureImage}
              onHoverPixel={(info) => setTextureHoverInfo(info)}
              mapPixel={mapHoverInfo}
              setEditIndex={(edit: PixelInfo) => addEdit(edit)}
            />
          </div>
          <div className="bg-purple-200 flex items-center justify-center overflow-hidden relative h-full w-full">
            <MappedCanvasViewer mapImage={mapImage} textureImage={textureImage} editIndex={edits} mapPixel={mapHoverInfo}/>
          </div>
        </Split>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-[50%] shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Help</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowHelp(false)}
              >
                ✕
              </button>
            </div>
            <div className="text-gray-700">
              <p><b>Instructions:</b></p>
              <p>1. Upload map png. This will show on the left and is the pixel map where each pixel's color value will be interpreted as coordinates.</p>
              <p>2. Upload texture png. This is where the map's color coords will be mapped to.</p>
              <p>3. In the 2 grid columns to the left you can zoom out (scroll wheel), and then pan (middle mouse button) to find where it placed your chosen pngs.</p>
              <p>4. The third column will display the resulting image created from the map.</p>
              <p><b>To Edit:</b></p>
              <p>1. In the texture column (middle) select a pixel you would like to use. The yellow box should turn green.</p>
              <p>2. On the map column (left) you can now click a pixel to change its color so it's mapped to the selected texture coordinate.</p>
              <p>3. In the preview column (right) you will see the result of changes you made.</p>
              <p>4. Click the "Donload Map" button on the top to download your edited map.</p>
              <p><b>Notes:</b></p>
              <p>* Refresh the page to reset everything.</p>
              <p>* Everything is done locally on your browser. Nothing is sent to a server.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
