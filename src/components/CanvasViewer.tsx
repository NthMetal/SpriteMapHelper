import React, { useRef, useEffect, useState } from 'react';
import * as UPNG from 'upng-js';

export interface PixelInfo {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  selected: boolean;
}

interface CanvasViewerProps {
  imageSrc: string | null;
  canvasId: string;
  onHoverPixel: (info: PixelInfo | null) => void;
  texturePixel?: PixelInfo | null;
  mapPixel?: PixelInfo | null;
  setEditIndex?: (idx: PixelInfo) => void
}

const CanvasViewer: React.FC<CanvasViewerProps> = ({
  imageSrc,
  onHoverPixel,
  texturePixel,
  mapPixel,
  canvasId,
  setEditIndex,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvas = useRef<HTMLCanvasElement | null>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [imageBuffer, setImageBuffer] = useState<UPNG.Image | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const [currentPixel, setCurrentPixel] = useState<PixelInfo | null>(null);

  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Load image
  useEffect(() => {
    if (!imageSrc) {
      setLoadedImage(null);
      setImageBuffer(null);
      return;
    }

    const img = new Image();
    img.src = imageSrc;
    img.onload = async () => {
      setLoadedImage(img);
      const response = await fetch(img.src);
      const buffer = await response.arrayBuffer();
      const decoded = UPNG.decode(buffer);
      setImageBuffer(decoded);

      // Create offscreen canvas and image data
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        offCtx.drawImage(img, 0, 0);
        const data = offCtx.getImageData(0, 0, img.width, img.height);
        setImageData(data);
      }
      offscreenCanvas.current = offCanvas;
    };
  }, [imageSrc]);

  const getPixelRGBA = (x: number, y: number) => {
    if (imageData && x >= 0 && y >= 0 && x < imageData.width && y < imageData.height) {
      const index = (y * imageData.width + x) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      const a = imageData.data[index + 3];
      return [r, g, b, a];
    }
    return null;
  };

  const setPixel = (x: number, y: number, r: number, g: number, b: number, a: number = 255) => {
    if (!imageData) return;

    const index = (y * imageData.width + x) * 4;
    imageData.data[index] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = a;

    if (offscreenCanvas.current) {
      const ctx = offscreenCanvas.current.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
        drawMainCanvas();
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const imageX = Math.floor((mouseX - offset.x) / scale);
    const imageY = Math.floor((mouseY - offset.y) / scale);

    if (isPanning.current) {
      e.preventDefault();
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }

    if (!hoverEnabled) return;

    setMousePos({ x: imageX, y: imageY });
    const color = getPixelRGBA(imageX, imageY);
    if (color) {
      const [r, g, b, a] = color;
      const pixel = { x: imageX, y: imageY, r, g, b, a, selected: false };
      setCurrentPixel(pixel);
      onHoverPixel(pixel);
    } else {
      setCurrentPixel(null);
      onHoverPixel(null);
    }
  };

  const handleMouseUp = () => {
    isPanning.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomIntensity = 0.001;
    const newScale = Math.max(0.1, scale - e.deltaY * zoomIntensity);

    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;

    const newOffsetX = mouseX - worldX * newScale;
    const newOffsetY = mouseY - worldY * newScale;

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.button === 0 && currentPixel && mapPixel) {
      // Left click to color the pixel red
      setHoverEnabled((prev) => {
        if (prev) {
          if (currentPixel) onHoverPixel({...currentPixel, selected: hoverEnabled});
        }
        return !prev;
      });
    }
    if (e.button === 0 && currentPixel && texturePixel && texturePixel.selected) {
      setPixel(currentPixel.x, currentPixel.y, texturePixel.x, texturePixel.y, 0, 255);
      if (setEditIndex) setEditIndex({
        x: currentPixel.x, y: currentPixel.y, r: texturePixel.x, g: texturePixel.y, b: 0, a: 255, selected: hoverEnabled
      });
    }
  };

  const drawMainCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid background
    const gridSize = 32;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#add8e6';

    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);

    if (offscreenCanvas.current) {
      ctx.drawImage(offscreenCanvas.current, 0, 0);
    }

    if (mousePos) {
      ctx.strokeStyle = texturePixel && texturePixel.selected ?
        hoverEnabled ? 'orange' : 'red' :
        hoverEnabled ? 'yellow' : 'green';
      ctx.lineWidth = 4 / scale;
      let square_size = 0.2;
      ctx.strokeRect(
        mousePos.x - square_size / 2,
        mousePos.y - square_size / 2,
        1.0 + square_size,
        1.0 + square_size
      );
    }

    if (mapPixel) {
      ctx.strokeStyle = 'blue';
      ctx.lineWidth = 4 / scale;
      let square_size = 0.2;
      let map_uv = {
        x: mapPixel.r,
        y: Math.max(mapPixel.g, mapPixel.b),
      };
      ctx.strokeRect(
        map_uv.x - square_size / 2,
        map_uv.y - square_size / 2,
        1.0 + square_size,
        1.0 + square_size
      );
    }
  };

  useEffect(() => {
    drawMainCanvas();
  }, [loadedImage, scale, offset, mousePos, hoverEnabled, mapPixel]);

  return (
    <canvas
      ref={canvasRef}
      id={canvasId}
      width={window.innerWidth}
      height={window.innerHeight}
      className="bg-white rounded border border-gray-400"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onWheel={handleWheel}
    />
  );
};

export default CanvasViewer;
