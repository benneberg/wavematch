import React, { useState } from 'react';
import { X, Book, Activity, Music, Mic2 } from 'lucide-react';
import { BButton } from './BrutalistUI';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
    const [tab, setTab] = useState<'BASICS' | 'MODES' | 'SCORING'>('BASICS');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b-4 border-black bg-yellow-400">
                    <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
                        <Book size={28}/> MANUAL
                    </h2>
                    <button onClick={onClose} className="hover:bg-black hover:text-white p-1 rounded border-2 border-transparent hover:border-black transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b-4 border-black bg-gray-100">
                    {(['BASICS', 'MODES', 'SCORING'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-3 font-bold text-sm transition-colors ${tab === t ? 'bg-black text-white' : 'hover:bg-gray-200 text-gray-500'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-4">
                    {tab === 'BASICS' && (
                        <div className="space-y-4">
                            <p className="font-bold">
                                Welcome to WaveMatch. Your goal is to synthesize a sound that matches the Target Signal perfectly.
                            </p>
                            <hr className="border-black/10" />
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <div className="bg-black text-white font-mono font-bold p-2 h-min rounded">1</div>
                                    <div>
                                        <h4 className="font-black">VISUAL MATCH</h4>
                                        <p className="text-sm font-mono text-gray-600">Align the <span className="text-blue-600 font-bold">BLUE</span> wave (Yours) with the <span className="text-red-600 font-bold">RED</span> wave (Target).</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="bg-black text-white font-mono font-bold p-2 h-min rounded">2</div>
                                    <div>
                                        <h4 className="font-black">AURAL MATCH</h4>
                                        <p className="text-sm font-mono text-gray-600">Use <span className="font-bold border border-black px-1">HOLD TO COMPARE</span> to listen. Train your ears to detect pitch and volume differences.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="bg-black text-white font-mono font-bold p-2 h-min rounded">3</div>
                                    <div>
                                        <h4 className="font-black">CONTROLS</h4>
                                        <ul className="text-sm font-mono text-gray-600 list-disc pl-4 mt-1">
                                            <li><span className="font-bold">WAVEFORM:</span> The "Texture" or timbre of the sound.</li>
                                            <li><span className="font-bold">FREQUENCY:</span> The Pitch (Speed). Controls wave width.</li>
                                            <li><span className="font-bold">GAIN:</span> The Volume. Controls wave height.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'MODES' && (
                        <div className="space-y-4">
                            <div className="border-l-4 border-blue-500 pl-4">
                                <h4 className="font-black flex items-center gap-2"><Music size={18}/> CAMPAIGN</h4>
                                <p className="text-sm font-mono">Progress through difficulty tiers. From Sine waves to complex Detuned saws.</p>
                            </div>
                            <div className="border-l-4 border-purple-500 pl-4">
                                <h4 className="font-black flex items-center gap-2"><Activity size={18}/> INFINITE SURF</h4>
                                <p className="text-sm font-mono">Endless randomized puzzles. Fast-paced arcade action.</p>
                            </div>
                            <div className="border-l-4 border-red-500 pl-4">
                                <h4 className="font-black flex items-center gap-2"><Activity size={18}/> WAVES OF NERVES</h4>
                                <p className="text-sm font-mono">High pressure. Time decays rapidly. Speed grants points.</p>
                            </div>
                            <div className="border-l-4 border-green-500 pl-4">
                                <h4 className="font-black flex items-center gap-2"><Mic2 size={18}/> SAMPLER CLASH</h4>
                                <p className="text-sm font-mono">Record your own sound. The Target will warp it. You must match the playback speed and filter brightness.</p>
                            </div>
                        </div>
                    )}

                    {tab === 'SCORING' && (
                        <div className="space-y-4">
                            <p className="font-bold text-center bg-gray-100 p-2">
                                POINTS = (BASE × STREAK) + TIME BONUS
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                                <div className="bg-yellow-100 p-2 border-2 border-yellow-400">
                                    <div className="font-bold">STREAK MULTIPLIER</div>
                                    <div>x1.5 per win</div>
                                    <div className="text-xs text-gray-500">Don't break the chain!</div>
                                </div>
                                <div className="bg-blue-100 p-2 border-2 border-blue-400">
                                    <div className="font-bold">ACCURACY</div>
                                    <div>&gt;85% to Win</div>
                                    <div className="text-xs text-gray-500">Precision matters.</div>
                                </div>
                            </div>
                            <p className="text-xs text-center text-gray-500 mt-4">
                                * In "Waves of Nerves", points are purely based on remaining time and accuracy.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t-4 border-black bg-gray-50 text-center">
                    <BButton onClick={onClose} variant="primary" className="w-full">
                        UNDERSTOOD
                    </BButton>
                </div>
            </div>
        </div>
    );
};