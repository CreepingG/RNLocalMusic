import TrackPlayer from 'react-native-track-player';

module.exports = {
    play: () => TrackPlayer.play(),
    pause: () => TrackPlayer.pause(),
    next: () => {console.log(11)},
    previous: () => {}
};