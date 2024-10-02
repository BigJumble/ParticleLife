
import { useState } from 'react';
import Simulation from './Simulation';
import Menu from './Menu';

function App() {
    //2d array of floats
    const [forceTable, setForceTable] = useState<number[][]>([]);
    return (
    <>
        {!navigator.gpu ? (
            <p style={{ position: 'absolute', zIndex: 1, color: 'red' }}>
                WebGPU is not supported in this browser. Please try Chrome, Edge, or Opera.
            </p>
        ) : (
            <>
                <Simulation forceTable={forceTable} />
                <Menu setForceTable={setForceTable} />
            </>
        )}
    </>
    );
}

export default App;