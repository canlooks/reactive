import {createRoot} from 'react-dom/client'
import {RC} from '../src/react'

const App = RC(() => {

    return (
        <>
        </>
    )
})

createRoot(document.getElementById('app')!).render(<App/>)