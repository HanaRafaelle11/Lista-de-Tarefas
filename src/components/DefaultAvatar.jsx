import React from 'react';

export default function DefaultAvatar({ size = 32, className = '' }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Body shape: #7B7FEA */}
      <path d="M50,45 C28,45 20,62 20,82 C20,88 25,90 35,90 L65,90 C75,90 80,88 80,82 C80,62 72,45 50,45 Z" fill="#7B7FEA" />
      {/* Accent petal: #A5B4FC */}
      <path d="M50,45 C50,45 68,58 68,80 C68,86 63,90 55,90 L50,90 C45,90 40,86 40,80 C40,65 50,45 50,45 Z" fill="#A5B4FC" />
      {/* Head: #5E60CE */}
      <circle cx="50" cy="25" r="14" fill="#5E60CE" />
    </svg>
  );
}
