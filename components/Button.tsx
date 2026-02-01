import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  icon,
  className = '',
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]";
  
  const variants = {
    // Terracotta with soft colored shadow
    primary: "bg-[#D97757] hover:bg-[#C06042] text-[#FFFBF7] shadow-[0_8px_20px_-6px_rgba(217,119,87,0.4)] hover:shadow-[0_12px_24px_-6px_rgba(217,119,87,0.5)] border border-transparent",
    // Warm charcoal
    secondary: "bg-[#4A4238] hover:bg-[#363028] text-[#FFFBF7] shadow-lg border border-transparent",
    // Soft Outline
    outline: "bg-transparent border-2 border-[#E5E0D8] text-[#8C857B] hover:border-[#D97757] hover:text-[#D97757]",
    // Ghost
    ghost: "bg-transparent text-[#8C857B] hover:bg-[#F2EFE9] hover:text-[#4A4238]"
  };

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthStyle} ${className}`} 
      {...props}
    >
      {icon && <span className="mr-2.5 opacity-90">{icon}</span>}
      {children}
    </button>
  );
};