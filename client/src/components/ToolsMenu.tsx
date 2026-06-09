import { useState } from 'react';
import { ChevronDown, Scissors, Sparkles } from 'lucide-react';

// Import custom icons
import stationeryIcon from '../assets/icons/stationery-tool.png';
import pencilIcon from '../assets/icons/pencil-tool.png';
import eraserIcon from '../assets/icons/eraser-tool.png';

interface ToolsMenuProps {
    activeTool: 'pencil' | 'freehand' | 'eraser' | 'scissors' | 'pin' | null;
    onToolSelect: (tool: 'pencil' | 'freehand' | 'eraser' | 'scissors' | 'pin' | null) => void;
    eraserMode: 'full' | 'partial';
    onEraserModeChange: (mode: 'full' | 'partial') => void;
    eraserSize: number;
    onEraserSizeChange: (size: number) => void;
}

export default function ToolsMenu({
    activeTool,
    onToolSelect,
    eraserMode,
    onEraserModeChange,
    eraserSize,
    onEraserSizeChange
}: ToolsMenuProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    return (
        <div className="absolute top-20 md:top-24 right-2.5 z-[1000] flex flex-col items-end pointer-events-none">
            {/* Main Stationery Icon */}
            <div className="group relative flex items-center justify-end mb-2 pointer-events-auto">
                <span className="hidden md:block absolute right-14 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Select tool to draw
                </span>
                <button
                    onClick={toggleMenu}
                    className={`
                        w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl border-2 shadow-lg flex items-center justify-center
                        hover:bg-gray-50 transition-all duration-200 transform hover:scale-105
                        ${isOpen ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
                    `}
                >
                    <img src={stationeryIcon} alt="Tools" className="w-6 h-6 md:w-8 md:h-8 object-contain" />
                </button>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 p-2 flex flex-col gap-2 min-w-[200px] animate-in slide-in-from-top-2 fade-in duration-200 origin-top-right pointer-events-auto">

                    {/* Pencil Tool */}
                    <button
                        onClick={() => onToolSelect('pencil')}
                        className={`
                            flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left
                            ${activeTool === 'pencil' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}
                        `}
                    >
                        <img src={pencilIcon} alt="Pencil" className="w-6 h-6 object-contain" />
                        <span className="text-sm font-medium">Draw</span>
                    </button>

                    {/* Freehand Tool */}
                    <button
                        onClick={() => onToolSelect('freehand')}
                        className={`
                            flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left
                            ${activeTool === 'freehand' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}
                        `}
                    >
                        <div className="w-6 h-6 flex items-center justify-center text-amber-500 animate-pulse">
                            <Sparkles size={20} />
                        </div>
                        <span className="text-sm font-medium">Freehand Draw</span>
                    </button>

                    {/* Scissors Tool */}
                    <button
                        onClick={() => onToolSelect('scissors')}
                        className={`
                            flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left
                            ${activeTool === 'scissors' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}
                        `}
                    >
                        <div className="w-6 h-6 flex items-center justify-center text-gray-600">
                            <Scissors size={20} />
                        </div>
                        <span className="text-sm font-medium">Trim Boundaries</span>
                    </button>

                    {/* Eraser Tool */}
                    <div className="flex flex-col">
                        <button
                            onClick={() => onToolSelect('eraser')}
                            className={`
                                flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left
                                ${activeTool === 'eraser' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}
                            `}
                        >
                            <img src={eraserIcon} alt="Eraser" className="w-6 h-6 object-contain" />
                            <span className="text-sm font-medium">Erase</span>
                            {activeTool === 'eraser' && (
                                <ChevronDown size={14} className="ml-auto" />
                            )}
                        </button>

                        {/* Eraser Options */}
                        {activeTool === 'eraser' && (
                            <div className="ml-9 mr-2 mt-1 mb-2 p-2 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                                {/* Mode Toggle */}
                                <div className="flex bg-gray-200 rounded-lg p-1">
                                    <button
                                        onClick={() => onEraserModeChange('full')}
                                        className={`flex-1 text-[10px] font-bold py-1 rounded-md transition-all ${eraserMode === 'full' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                                    >
                                        Full
                                    </button>
                                    <button
                                        onClick={() => onEraserModeChange('partial')}
                                        className={`flex-1 text-[10px] font-bold py-1 rounded-md transition-all ${eraserMode === 'partial' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                                    >
                                        Partial
                                    </button>
                                </div>

                                {/* Size Slider (Partial Mode Only) */}
                                {eraserMode === 'partial' && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-gray-500">
                                            <span>Size</span>
                                            <span>{eraserSize}px</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="10"
                                            max="100"
                                            value={eraserSize}
                                            onChange={(e) => onEraserSizeChange(Number(e.target.value))}
                                            className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
