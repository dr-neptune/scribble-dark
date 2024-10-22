// src/App.jsx
import React from 'react';
import IframeViewer from './components/IframeViewer';
import ColorEditor from './components/ColorEditor';
import './App.css';
import '@mantine/core/styles.css';

import { MantineProvider, Flex, Box } from '@mantine/core';

function App() {
    return (
        <>
            <MantineProvider>
                <ColorEditor />
            </MantineProvider>
        </>
    );
}

export default App;
