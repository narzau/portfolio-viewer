'use client';

import React from 'react';
import Image from 'next/image'; // Import next/image

// Remove the cryptoIcons map, as the logic is now in the API route
// const cryptoIcons: Record<string, string> = { ... };

interface CryptoLogoProps {
  symbol: string;
  size?: number;
  className?: string;
}

// Generic fallback icon (can be enhanced later)
const FallbackDisplay = ({ symbol, size }: { symbol: string, size: number }) => (
  <div 
    className="flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 font-semibold"
    style={{ width: size, height: size, fontSize: size * 0.4 }}
  >
    {symbol.slice(0, 3).toUpperCase()} {/* Make sure fallback text is visible */}
  </div>
);

export const CryptoLogo: React.FC<CryptoLogoProps> = ({ 
  symbol, 
  size = 40, 
  className = '' 
}) => {
  const [error, setError] = React.useState(false);
  
  // Construct the path to the local logo file within /public
  const logoPath = symbol ? `/logos/${symbol.toLowerCase()}.svg` : null;

  React.useEffect(() => {
    // Reset error state when symbol changes
    setError(false); 
  }, [symbol]);

  if (!symbol || !logoPath) {
    // Render nothing or a placeholder if symbol is missing
    // Or could render a generic fallback icon here
    return <div style={{ width: size, height: size }} className={className}></div>;
  }

  // Add specific padding and negative margin for ETH logo to visually scale and position it
  const imageStyle = symbol.toUpperCase() === 'ETH' 
    ? { padding: `${size * 0.15}px`, marginTop: `-${size * 0.20}px` } // 15% padding, -20% top margin
    : {}; 

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {error ? (
        <FallbackDisplay symbol={symbol} size={size} />
      ) : (
        <Image // Use next/image
          src={logoPath} // Use the local path
          alt={`${symbol} logo`}
          width={size} // Use width/height props for next/image
          height={size}
          className="object-contain" // Basic styling for image
          style={imageStyle} // Apply conditional style
          unoptimized // Add this if you haven't configured an image loader for SVGs
          onError={() => {
            console.warn(`Logo not found locally for ${symbol} at ${logoPath}. Using fallback.`);
            setError(true);
          }}
          // Removed loading="lazy" as next/image handles loading optimization
        />
      )}
      {/* 
        Network badge logic removed. 
        TODO: Re-implement when network data is available in the Asset type from backend.
      */}
    </div>
  );
}; 