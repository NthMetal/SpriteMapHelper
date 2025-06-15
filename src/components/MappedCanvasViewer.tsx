import React, { useEffect, useRef, useState } from 'react';
import * as UPNG from 'upng-js';
import type { PixelInfo } from './CanvasViewer';

interface MappedCanvasViewerProps {
  mapImage: string | null;
  textureImage: string | null;
  editIndex: Map<string, {r: number, g: number, b: number, a: number}>;
  mapPixel: PixelInfo | null;
}

const MappedCanvasViewer: React.FC<MappedCanvasViewerProps> = ({ mapImage, textureImage, editIndex, mapPixel }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const imageData = imageDataRef.current;
    if (!canvas || !ctx || !imageData) return;

    // Create offscreen canvas to hold the imageData
    const offscreen = document.createElement('canvas');
    offscreen.width = imageData.width;
    offscreen.height = imageData.height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;
    offCtx.putImageData(imageData, 0, 0);

    // Resize canvas to match display size
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

    // Draw background
    ctx.fillStyle = '#f0f0f0'; // light gray
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    const gridSpacing = 32;
    ctx.strokeStyle = 'rgba(0, 180, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw image with transform
    ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0);

    if (mapPixel) {
      ctx.strokeStyle = 'blue';
      ctx.lineWidth = 4 / scale;
      let square_size = 0.2;
      let map_uv = {
        x: mapPixel.x,
        y: mapPixel.y,
      };
      ctx.strokeRect(
        map_uv.x - square_size / 2,
        map_uv.y - square_size / 2,
        1.0 + square_size,
        1.0 + square_size
      );
    }
    ctx.restore();
  };

  useEffect(() => {
    draw();
  }, [mapPixel]);

  useEffect(() => {
    const renderMappedImage = async () => {
      if (!mapImage || !textureImage || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const [mapResp, texResp] = await Promise.all([
        fetch(mapImage).then(res => res.arrayBuffer()),
        fetch(textureImage).then(res => res.arrayBuffer()),
      ]);
      const map_base_Buf = UPNG.decode(mapResp);

    //   const map_canvas = document.getElementById('map_canvas') as HTMLCanvasElement | null;
    //   const map_ctx = map_canvas?.getContext('2d');
    //   const map_imageData = map_canvas ? map_ctx?.getImageData(0, 0, map_base_Buf.width, map_base_Buf.height) : null;
    //   if (!map_imageData) { return }
    //   const data_buffer = map_imageData.data.buffer;

    //   const mapBuf = map_imageData;
      const mapBuf = UPNG.decode(mapResp);
      const texBuf = UPNG.decode(texResp);

      const mapRGBA = UPNG.toRGBA8(mapBuf)[0];
    //   const mapRGBA = data_buffer;
      const texRGBA = UPNG.toRGBA8(texBuf)[0];

      const output = ctx.createImageData(map_base_Buf.width, map_base_Buf.height);
      const outData = output.data;

      console.log("Edits: ", editIndex);

      for (let y = 0; y < map_base_Buf.height; y++) {
        for (let x = 0; x < map_base_Buf.width; x++) {
          const existing_color = editIndex.get(`${x},${y}`);
          const idx = (y * mapBuf.width + x) * 4;
          const map_pixel = mapRGBA.slice(idx, idx + 4);
          const map_color_array = new Uint8Array(map_pixel);

          const u = existing_color ? existing_color.r : map_color_array[0];
          const v = existing_color ? Math.max(existing_color.g, existing_color.b) : Math.max(map_color_array[1], map_color_array[2]);

          const texX = Math.min(u, texBuf.width - 1);
          const texY = Math.min(v, texBuf.height - 1);
          const texIdx = (texY * texBuf.width + texX) * 4;

          const tex_pixel = texRGBA.slice(texIdx, texIdx + 4);
          const tex_color_array = new Uint8Array(tex_pixel);

          outData[idx]     = tex_color_array[0];
          outData[idx + 1] = tex_color_array[1];
          outData[idx + 2] = tex_color_array[2];
          outData[idx + 3] = tex_color_array[3];
        }
      }

      imageDataRef.current = output;
      draw();
    };

    renderMappedImage();
  }, [mapImage, textureImage, editIndex]);

  const handleMouseDown = (e: React.MouseEvent) => {
    console.log(e);
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isPanning.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => {
      const next = { x: prev.x + dx, y: prev.y + dy };
      setTimeout(draw, 0);
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 0.001;
    const newScale = Math.max(0.1, scale - e.deltaY * zoomFactor);

    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;

    const newOffsetX = mouseX - worldX * newScale;
    const newOffsetY = mouseY - worldY * newScale;

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
    setTimeout(draw, 0);
  };

  return (
    <canvas
      ref={canvasRef}
      className="bg-white rounded border border-gray-400 w-full h-full"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    />
  );
};

export default MappedCanvasViewer;
