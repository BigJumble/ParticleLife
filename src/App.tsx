
import { useState } from 'react';
import Simulation from './Simulation';
import Menu from './Menu';

function App() {
    //2d array of floats
    const [forceTable, setForceTable] = useState<number[][]>([]);
    return (
    <>
        <Simulation forceTable={forceTable} />
        <Menu setForceTable={setForceTable} />
    </>);
}

export default App;