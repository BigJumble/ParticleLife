import React, { useState } from 'react';

interface MenuProps {
    setForceTable: React.Dispatch<React.SetStateAction<number[][]>>;
}

const Menu: React.FC<MenuProps> = ({ setForceTable }) => {
    const [localForceTable, setLocalForceTable] = useState<number[][]>(
        Array(4).fill(null).map(() => Array(4).fill(0))
    );
    const [isVisible, setIsVisible] = useState(true);

    const handleInputChange = (row: number, col: number, value: string) => {
        const newTable = localForceTable.map((r, i) =>
            i === row ? r.map((c, j) => j === col ? parseFloat(value) || 0 : c) : r
        );
        setLocalForceTable(newTable);
    };

    const handleSubmit = () => {
        setForceTable(localForceTable);
    };

    const colorNames = ['Green', 'Red', 'Purple', 'Yellow'];

    const toggleVisibility = () => {
        setIsVisible(!isVisible);
    };

    const randomizeForces = () => {
        const newTable = localForceTable.map(row =>
            row.map(() => Math.random() * 2 - 1) // Random value between -1 and 1
        );
        setLocalForceTable(newTable);
    };

    return (
        <>
            <button 
                onClick={toggleVisibility}
                style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    zIndex: 1000,
                }}
            >
                {isVisible ? 'Hide' : 'Show'} Menu
            </button>
            {isVisible && (
                <div style={{
                    position: 'absolute',
                    top: '50px',
                    left: '10px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    padding: '20px',
                    borderRadius: '5px',
                    backdropFilter: 'blur(5px)',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                    <table>
                        <thead>
                            <tr>
                                <th></th>
                                {colorNames.map((name, index) => (
                                    <th key={index}>{name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {localForceTable.map((row, i) => (
                                <tr key={i}>
                                    <th>{colorNames[i]}</th>
                                    {row.map((cell, j) => (
                                        <td key={j}>
                                            <input
                                                type="number"
                                                value={cell.toFixed(1)}
                                                onChange={(e) => handleInputChange(i, j, e.target.value)}
                                                style={{ width: '40px' }}
                                                step="0.5"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ marginTop: '10px' }}>
                        <button onClick={handleSubmit} style={{ marginRight: '10px' }}>
                            Apply Forces
                        </button>
                        <button onClick={randomizeForces}>
                            Randomize
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default Menu;
