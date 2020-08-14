import TrackPlayer from 'react-native-track-player';
import RNFS from 'react-native-fs';
import localTrack from "./resources/pure.m4a";

interface File{
	id: number | string,
	url: string,
	title: string,
	volume: number,
	weight: number,
	startTime: number,
	endTime: number
}

const DefaultMusic: File = {
	id: 0,
	title: 'pure',
	url: localTrack,
	volume: 0.8,
	weight: 10,
	startTime: 0,
	endTime: 0
}

class HistoryList<T> extends Array {
	index:number = -1;
  
	Add(item: T){
	  this.index += 1;
	  this[this.index] = item;
	}
  
	Cur(): T{
	  return this[this.index];
	}
  
	Next(): T | null{
	  if (this.length <= this.index + 1){
		return null;
	  }
	  else{
		this.index += 1;
		return this[this.index];
	  }
	}
  
	Previous(): T | null{
	  if(this.index < 1){
		return null;
	  }
	  else{
		this.index -= 1;
		return this[this.index];
	  }
	}
}

async function GetAllFiles(dir: string){
    let items = await RNFS.readDir(dir);
    let urls = items
      .filter(item=>item.isFile())
      .map(item=>item.path)
      .filter(path=>['mp3','aac','wav'].includes((path.match(/\.(\w+)$/)||[])[1]));
    return urls;
}

function MakeFile(url: string, id: number) : File{
	return {
		id,
		url,
		title: url.match(/.*\/(.*)\.\w+$/)[1],
		volume: 0.8,
		weight: 10,
		startTime: 0,
		endTime: 0
	}
}

class PlayControl {
	list: File[];
	history: HistoryList<File>;
	onStart: (toPlay: File) => any;

	getPosition = () => TrackPlayer.getPosition();
	getDuration = () => TrackPlayer.getDuration();

	constructor() {
		this.list = [];
		this.history = new HistoryList();
		console.log(1);
	}

	filePath = [RNFS.DocumentDirectoryPath + '/MusicLists/0.js', RNFS.DocumentDirectoryPath + '/MusicLists']

	async load(){
		let exists = await RNFS.exists(this.filePath[0]);
		if (exists){
			const json = await RNFS.readFile(this.filePath[0]);
			this.list = JSON.parse(json);
		}
		else{
			const urls = await GetAllFiles('/storage/emulated/0/Music');
			this.list = urls.map(MakeFile);
			await this.save();
		}
	}

	async save(){
		await RNFS.mkdir(this.filePath[1]);
		await RNFS.writeFile(this.filePath[0], JSON.stringify(this.list));
	}

	add(url: string){
		this.list.push(MakeFile(url, this.list.length));
		this.save();
	}

	get current(): File{
		return this.history.Cur() || {
			id: 0,
			title: '',
			url: '',
			volume: 0,
			weight: 0,
			startTime: 0,
			endTime: 0
		};
	}

	async toggle() {
		const state = await TrackPlayer.getState();
		return state === TrackPlayer.STATE_PLAYING ? TrackPlayer.pause() : TrackPlayer.play();
	}

	async start(file: number | File | undefined, pause: boolean) {
		if (typeof file === 'number') file = this.list[file];
		if (!file) file = DefaultMusic;
		let prev = await TrackPlayer.getCurrentTrack();
		await TrackPlayer.add({
			id: file.id.toString(),
			url: file.url,
			title: file.title,
			artist: ''
		});
		if (prev) {
			await TrackPlayer.skipToNext();
			await TrackPlayer.remove(prev);
		}
		pause || await TrackPlayer.play();
		await TrackPlayer.setVolume(file.volume || 0.8);
		this.onStart && this.onStart(file);
	}

	random(range: number) {
		return Math.floor(Math.random() * range);
	}

	async skipToNext(pause?: boolean): Promise<File> {
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

	async skipToPrevious(pause?: boolean): Promise<File | void> {
		let file = this.history.Previous();
		if (file) {
			await this.start(file, pause);
			return file;
		} else {
			return;
		}
	}

	async jumpTo(seconds: number): Promise<number> {
		let duration = await this.getDuration();
		let position = await this.getPosition();
		console.log(seconds);
		if (duration > 0) seconds = Math.max(0, Math.min(duration, seconds));
		if (seconds === position) return seconds;
		await TrackPlayer.seekTo(seconds);
		return seconds;
	}
}

//module.exports = new PlayControl();
export default new PlayControl();