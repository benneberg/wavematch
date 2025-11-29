import React, { useState } from 'react';
import { audioEngine } from '../services/audioEngine';
import { BButton, BCard } from './BrutalistUI';
import { Mic, Upload, Play, Check, X, Save, AlertTriangle, Star } from 'lucide-react';
import { SampleSlotId, SampleSlot } from '../types';

const SLOTS: { id: SampleSlotId; name: string }[] = [
    { id: 'ui_click', name: 'BUTTON CLICK' },
    { id: 'ui_win', name: 'VICTORY SOUND' },
    { id: 'ui_lose', name: 'GAME OVER' },
    { id: 'wave_custom', name: 'CUSTOM WAVE' },
];

interface SamplerMenuProps {
    onClose: () => void;
}

export const SamplerMenu: React.FC<SamplerMenuProps> = ({ onClose }) => {
    const [recordingId, setRecordingId] = useState<SampleSlotId | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    // Force re-render to update status indicators
    const [_, setTick] = useState(0);

    const handleRecord = async (id: SampleSlotId) => {
        if (isRecording) return;
        setErrorMsg(null);
        setIsRecording(true);
        setRecordingId(id);
        
        try {
            // Record for 2 seconds max
            const buffer = await audioEngine.recordAudio(2000);
            
            if (buffer) {
                audioEngine.assignBuffer(id, buffer);
                // Playback immediately to confirm
                audioEngine.playSample(id);
            }
        } catch (e: any) {
            console.error(e);
            setErrorMsg("MIC ERROR: " + (e.message || "Check Permissions"));
        } finally {
            setIsRecording(false);
            setRecordingId(null);
            setTick(t => t + 1);
        }
    };

    const handleUpload = async (id: SampleSlotId, e: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMsg(null);
        if (e.target.files && e.target.files[0]) {
            try {
                const buffer = await audioEngine.uploadAudio(e.target.files[0]);
                if (buffer) {
                    audioEngine.assignBuffer(id, buffer);
                    audioEngine.playSample(id);
                    setTick(t => t + 1);
                } else {
                    setErrorMsg("UPLOAD ERROR: Decode failed");
                }
            } catch (e) {
                setErrorMsg("UPLOAD ERROR: Corrupt file?");
            }
        }
    };

    const handleEquip = (id: SampleSlotId) => {
        if (id === 'wave_custom') return;
        audioEngine.copyBuffer(id, 'wave_custom');
        audioEngine.playSample('wave_custom');
        setTick(t => t + 1);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-gray-200 overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="max-w-2xl mx-auto p-4 min-h-screen flex flex-col">
                <div className="flex justify-between items-center mb-8 border-b-4 border-black pb-4 bg-white p-4 shadow-lg sticky top-0 z-10">
                    <h1 className="text-3xl font-black italic tracking-tighter">SAMPLER // LAB</h1>
                    <button onClick={onClose} className="p-2 hover:bg-red-500 hover:text-white border-2 border-transparent hover:border-black rounded transition-all">
                        <X size={32} />
                    </button>
                </div>

                {errorMsg && (
                    <div className="bg-red-500 text-white p-4 font-bold border-4 border-black mb-6 flex items-center gap-2 animate-in shake">
                        <AlertTriangle /> {errorMsg}
                    </div>
                )}

                <div className="space-y-6 flex-grow">
                    <div className="bg-black text-white p-4 font-mono text-sm border-4 border-blue-500 mb-6">
                        <p className="mb-2">>> INSTRUCTIONS</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Record from Mic (max 2s) or Upload Audio File.</li>
                            <li>Click "USE AS WAVE" to assign a sound to the 'CUSTOM' wave slot.</li>
                            <li>Custom Waves are pitched based on A4 (440Hz).</li>
                        </ul>
                    </div>

                    {SLOTS.map((slot) => {
                        const hasBuffer = audioEngine.hasBuffer(slot.id);
                        const isEquipped = audioEngine.activeCustomSourceId === slot.id;

                        return (
                            <BCard key={slot.id} className="relative overflow-hidden group">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-xl font-black">{slot.name}</h3>
                                            {hasBuffer && (
                                                <span className="bg-green-500 text-black text-[10px] font-bold px-1.5 py-0.5 border border-black">LOADED</span>
                                            )}
                                        </div>
                                        <div className="text-xs font-mono text-gray-500 font-bold uppercase tracking-widest">{slot.id}</div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 items-center">
                                        {/* Equip Button (Copy to Custom Wave) */}
                                        {slot.id !== 'wave_custom' && (
                                            <BButton
                                                size="sm"
                                                variant={isEquipped ? 'success' : 'neutral'}
                                                disabled={!hasBuffer}
                                                onClick={() => handleEquip(slot.id)}
                                                title="Use this sound as the Main Custom Wave"
                                                className="!px-2 transition-all"
                                            >
                                                <Star 
                                                    size={16} 
                                                    className={`mr-1 ${isEquipped ? 'fill-black' : ''}`} 
                                                /> 
                                                {isEquipped ? 'ACTIVE' : 'USE AS WAVE'}
                                            </BButton>
                                        )}

                                        {/* Play Preview */}
                                        <BButton 
                                            size="sm" 
                                            onClick={() => audioEngine.playSample(slot.id)}
                                            disabled={!hasBuffer}
                                            variant="neutral"
                                            title="Preview Sound"
                                        >
                                            <Play size={18} className="fill-current" />
                                        </BButton>

                                        {/* Record */}
                                        <BButton 
                                            size="sm" 
                                            variant={recordingId === slot.id ? 'danger' : 'neutral'}
                                            onClick={() => handleRecord(slot.id)}
                                            className={recordingId === slot.id ? 'animate-pulse' : ''}
                                            disabled={isRecording && recordingId !== slot.id}
                                        >
                                            <Mic size={18} /> {recordingId === slot.id ? 'REC...' : 'REC'}
                                        </BButton>

                                        {/* Upload */}
                                        <div className="relative">
                                            <input 
                                                type="file" 
                                                accept="audio/*" 
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                onChange={(e) => handleUpload(slot.id, e)}
                                            />
                                            <BButton size="sm" variant="neutral" className="pointer-events-none">
                                                <Upload size={18} /> LOAD
                                            </BButton>
                                        </div>
                                    </div>
                                </div>
                            </BCard>
                        );
                    })}
                </div>
                
                <div className="mt-8 pt-4 border-t-4 border-black text-center">
                     <BButton size="lg" variant="success" className="w-full sm:w-auto" onClick={onClose}>
                        <Save className="inline mr-2" /> RETURN TO SYNTH
                     </BButton>
                </div>
            </div>
        </div>
    );
};