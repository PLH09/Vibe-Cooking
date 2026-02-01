import React from 'react';

// Effectively remove the component by rendering nothing.
// This handles the user request to remove the music player function without deleting the file (which isn't supported).
export const MusicPlayer: React.FC<any> = () => {
  return null;
};
