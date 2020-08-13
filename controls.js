import TrackPlayer from 'react-native-track-player';

class HistoryList extends Array {
	index = -1;
  
	Add(item){
	  this.index += 1;
	  this[this.index] = item;
	}
  
	Cur(){
	  return this[this.index];
	}
  
	Next(){
	  if (this.length <= this.index + 1){
		return null;
	  }
	  else{
		this.index += 1;
		return this[this.index];
	  }
	}
  
	Previous(){
	  if(this.index < 1){
		return null;
	  }
	  else{
		this.index -= 1;
		return this[this.index];
	  }
	}
}

class PlayControl {
	getPosition = () => TrackPlayer.getPosition();
	getDuration = () => TrackPlayer.getDuration();

	constructor() {
		this.list = [];
		this.history = new HistoryList();
	}

	get current(){
		return this.history.Cur();
	}

	async toggle() {
		const state = await TrackPlayer.getState();
		return state === TrackPlayer.STATE_PLAYING ? TrackPlayer.pause() : TrackPlayer.play();
	}

	async start(file, pause) {
		if (!isNaN(file)) file = this.list[file];
		let prev = await TrackPlayer.getCurrentTrack();
		await TrackPlayer.add(file);
		if (prev) {
			await TrackPlayer.skipToNext();
			await TrackPlayer.remove(prev);
		}
		pause || await TrackPlayer.play();
		this.onStart && this.onStart(file);
	}

	random(range) {
		return Math.floor(Math.random() * range);
	}

	async skipToNext(pause) {
		let file = this.history.Next();
		if (file) {
			await this.start(file, pause);
			return file;
		} else {
			let index = Math.floor(Math.random() * this.list.length);
			let file = this.list[index];
			this.history.Add(file);
			await this.start(file, pause);
			return file;
		}
	}

	async skipToPrevious(pause) {
		let file = this.history.Previous();
		if (file) {
			await this.start(file, pause);
			return file;
		} else {
			return;
		}
	}

	async jumpTo(seconds) {
		let duration = await this.getDuration();
		let position = await this.getPosition();
		console.log(seconds);
		if (duration > 0) seconds = Math.max(0, Math.min(duration, seconds));
		if (seconds === position) return seconds;
		await TrackPlayer.seekTo(seconds);
		return seconds;
	}
}

module.exports = new PlayControl();