// src/app/components/ShowUIButton.tsx

import { useMagic } from "../app/context/MagicProvider"

const ShowUIButton = () => {
  const { magic } = useMagic()

  // Define the event handler for the button click
  const handleShowUI = async () => {
    try {
      // Try to show the magic wallet user interface
      await magic?.wallet.showUI()
    } catch (error) {
      // Log any errors that occur during the process
      console.error("handleShowUI:", error)
    }
  }

  return (
    <button
      className="w-auto border border-white font-bold p-2 rounded-md"
      onClick={handleShowUI}
    >
      Show UI
    </button>
  )
}

export default ShowUIButton

    