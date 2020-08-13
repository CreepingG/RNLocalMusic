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
    Controls.play();
  })

  TrackPlayer.addEventListener('remote-pause', () => {
    Controls.pause();
  });

  TrackPlayer.addEventListener('remote-next', () => {
    Controls.next()
  });

  TrackPlayer.addEventListener('remote-previous', () => {
    Controls.previous()
  });

};