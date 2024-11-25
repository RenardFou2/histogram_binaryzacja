import React, { useRef, useState } from "react";

const Histogram = () => {
  const canvasRef = useRef(null);
  const [histogram, setHistogram] = useState(null);
  const [threshold, setThreshold] = useState(128);
  const [percentBlack, setPercentBlack] = useState(50);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => drawImage(img);
    }
  };

  const drawImage = (img) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    calculateHistogram();
  };

  const calculateHistogram = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const histogram = {
      red: new Array(256).fill(0),
      green: new Array(256).fill(0),
      blue: new Array(256).fill(0),
    };

    for (let i = 0; i < data.length; i += 4) {
      histogram.red[data[i]]++;
      histogram.green[data[i + 1]]++;
      histogram.blue[data[i + 2]]++;
    }

    setHistogram(histogram);
  };

  const stretchHistogram = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Znajdź p_min i p_max dla każdego kanału
    const findMinMax = (channel) => {
      const nonZeroValues = histogram[channel].reduce(
        (acc, value, index) => (value > 0 ? [...acc, index] : acc),
        []
      );
      return {
        min: Math.min(...nonZeroValues),
        max: Math.max(...nonZeroValues),
      };
    };

    const redRange = findMinMax("red");
    const greenRange = findMinMax("green");
    const blueRange = findMinMax("blue");

    // Rozciąganie pikseli
    for (let i = 0; i < data.length; i += 4) {
      data[i] = ((data[i] - redRange.min) * 255) / (redRange.max - redRange.min); // Red
      data[i + 1] =
        ((data[i + 1] - greenRange.min) * 255) /
        (greenRange.max - greenRange.min); // Green
      data[i + 2] =
        ((data[i + 2] - blueRange.min) * 255) /
        (blueRange.max - blueRange.min); // Blue
    }

    ctx.putImageData(imageData, 0, 0);
    calculateHistogram();
  };
  
  const renderHistogram = (channel, color) => {
    if (!histogram) return null;
    const values = histogram[channel];

    return (
      <div>
        <h3>{color} Channel</h3>
        <svg width="256" height="100">
          {values.map((value, index) => (
            <rect
              key={index}
              x={index}
              y={100 - value / 10}
              width="1"
              height={value / 10}
              fill={color}
            />
          ))}
        </svg>
      </div>
    );
  };

  const getGrayscaleData = (data) => {
    const grayscaleData = [];
    for (let i = 0; i < data.length; i += 4) {
      const grayscale = (data[i] + data[i + 1] + data[i + 2]) / 3;
      grayscaleData.push(grayscale);
    }
    return grayscaleData;
  };

  // Binaryzacja z ręcznym progiem
  const applyManualThreshold = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const grayscale = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const binaryValue = grayscale >= threshold ? 255 : 0;

      data[i] = binaryValue;
      data[i + 1] = binaryValue;
      data[i + 2] = binaryValue;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // Binaryzacja z Percent Black Selection
  const applyPercentBlack = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const grayscaleData = getGrayscaleData(data);
    grayscaleData.sort((a, b) => a - b); // Sortujemy piksele rosnąco

    const totalPixels = grayscaleData.length;
    const blackPixelCount = Math.floor((percentBlack / 100) * totalPixels);
    const threshold = grayscaleData[blackPixelCount]; // Próg binaryzacji

    for (let i = 0; i < data.length; i += 4) {
      const grayscale = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const binaryValue = grayscale >= threshold ? 255 : 0;

      data[i] = binaryValue;
      data[i + 1] = binaryValue;
      data[i + 2] = binaryValue;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // Binaryzacja z Iterative Mean Selection
  const applyIterativeMean = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const grayscaleData = getGrayscaleData(data);
    let threshold = grayscaleData.reduce((sum, val) => sum + val, 0) / grayscaleData.length; // Początkowy próg (średnia)

    let newThreshold;
    do {
      const lowerGroup = grayscaleData.filter((val) => val < threshold);
      const upperGroup = grayscaleData.filter((val) => val >= threshold);

      const lowerMean = lowerGroup.reduce((sum, val) => sum + val, 0) / lowerGroup.length || 0;
      const upperMean = upperGroup.reduce((sum, val) => sum + val, 0) / upperGroup.length || 0;

      newThreshold = (lowerMean + upperMean) / 2;

      if (Math.abs(newThreshold - threshold) < 1) break; // Sprawdzenie stabilności
      threshold = newThreshold;
    } while (true);

    for (let i = 0; i < data.length; i += 4) {
      const grayscale = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const binaryValue = grayscale >= threshold ? 255 : 0;

      data[i] = binaryValue;
      data[i + 1] = binaryValue;
      data[i + 2] = binaryValue;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  return (
    <div>
      <h1>Histogram Generator</h1>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      <canvas ref={canvasRef} style={{ display: "block", border: "1px solid black" }}></canvas>
      <button onClick={stretchHistogram}>Stretch Histogram</button>
      <div>
        {renderHistogram("red", "red")}
        {renderHistogram("green", "green")}
        {renderHistogram("blue", "blue")}
      </div>
      <div>
        <div>
          <label>Próg ręczny: {threshold}</label>
          <input
            type="range"
            min="0"
            max="255"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
          />
        </div>
        <div>
          <label>Procent czerni: {percentBlack}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={percentBlack}
            onChange={(e) => setPercentBlack(parseInt(e.target.value, 10))}
          />
          <button onClick={applyPercentBlack}>Binaryzacja Percent Black</button>
        </div>
        <div>
          <button onClick={applyIterativeMean}>Binaryzacja Iterative Mean</button>
        </div>
      </div>
      <button onClick={applyManualThreshold}>Binaryzacja z progiem ręcznym</button>
    </div>
  );
};

export default Histogram;
