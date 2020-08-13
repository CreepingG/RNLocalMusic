/**
 * This is the code that will run tied to the player.
 *
 * The code here might keep running in the background.
 *
 * You should put everything here that should be tied to the playback but not the UI
 * such as processing media buttons or analytics
 */

import TrackPlayer from 'react-native-track-player';
import Controls from './controls';

module.exports = async function() {

  TrackPlayer.addEventListener('remote-play', () => {
    TrackPlayer.play();
  })

  TrackPlayer.addEventListener('remote-pause', () => {
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener('remote-next', () => {
    Controls.skipToNext()
  });

  TrackPlayer.addEventListener('remote-previous', () => {
    Controls.skipToPrevious()
  });

};