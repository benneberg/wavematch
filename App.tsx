import React from 'react';
import WaveClashGame from './components/WaveClashGame';

const App: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-gray-50">
       <WaveClashGame />
    </div>
  );
};

export default App;