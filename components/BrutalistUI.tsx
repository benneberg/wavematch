
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'success' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
}

export const BButton: React.FC<ButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  size = 'md',
  ...props 
}) => {
  const baseStyles = "font-bold border-4 border-black transition-all active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed select-none touch-manipulation";
  
  const variants = {
    primary: "bg-blue-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-400",
    danger: "bg-red-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-400",
    success: "bg-green-500 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-green-400",
    neutral: "bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100",
  };

  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-xl",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  id?: string;
}

export const BCard: React.FC<CardProps> = ({ children, className = '', title, id }) => {
  return (
    <div id={id} className={`border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 max-w-full ${className}`}>
      {title && (
        <div className="mb-4 border-b-4 border-black pb-2">
          <h2 className="text-2xl font-black uppercase tracking-tighter">{title}</h2>
        </div>
      )}
      {children}
    </div>
  );
};

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  unit?: string;
  id?: string;
}

export const BSlider: React.FC<SliderProps> = ({ label, value, min, max, step = 1, onChange, unit = '', id }) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className="mb-6 w-full" id={id}>
      <div className="flex justify-between mb-2 font-bold font-mono text-sm pointer-events-none">
        <label className="uppercase">{label}</label>
        <span className="whitespace-nowrap">{value}{unit}</span>
      </div>
      
      {/* 
          TOUCH FIX: 
          The container is tall (h-14) to catch fat fingers.
          The input is absolute, covers the WHOLE container, and has z-index 50 to be the top interaction layer.
          The visuals (track, thumb) are below the input but positioned to look centered.
      */}
      <div className="relative w-full h-14 touch-none select-none max-w-full group">
        {/* Track Background */}
        <div className="absolute top-1/2 left-0 w-full h-4 bg-white border-2 border-black -translate-y-1/2 pointer-events-none z-10"></div>
        
        {/* Filled Track */}
        <div 
          className="absolute top-1/2 left-0 h-4 bg-blue-500 -translate-y-1/2 border-2 border-black border-r-0 pointer-events-none z-20 transition-all duration-75"
          style={{ width: `${percentage}%` }}
        ></div>

        {/* Thumb Visual */}
        <div 
          className="absolute top-1/2 w-8 h-8 bg-white border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-75 group-active:bg-blue-100"
          style={{ left: `${percentage}%` }}
        ></div>

        {/* The Actual Input - Invisible but interactive over the whole area */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50 touch-manipulation"
        />
      </div>
    </div>
  );
};

interface ToggleGroupProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (val: string) => void;
  label?: string;
  id?: string;
}

export const BToggleGroup: React.FC<ToggleGroupProps> = ({ options, value, onChange, label, id }) => {
  return (
    <div className="mb-6 max-w-full" id={id}>
      {label && <div className="mb-2 font-bold font-mono text-sm uppercase">{label}</div>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`
              px-4 py-2 border-4 border-black font-bold text-sm uppercase
              transition-all flex-1 sm:flex-none
              ${value === opt.value 
                ? 'bg-black text-white translate-x-1 translate-y-1 shadow-none' 
                : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none'}
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
