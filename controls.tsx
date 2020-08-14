import TrackPlayer from 'react-native-track-player';
import RNFS from 'react-native-fs';
import localTrack from "./resources/pure.m4a";

interface File{
	id: number,
	url: string,
	title: string,
	volume: number,
	weight: number,
	startTime: number,
	endTime: number,
	duration?: number
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

class HistoryList<T> extends Array<T> {
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

enum LoopMode{
	'noLoop', 'order', 'shuffle', 'single'
}

class PlayControl {
	list: File[];
	_history: HistoryList<File>;
	onStart: (toPlay: File) => any;

	getPosition = () => TrackPlayer.getPosition();
	getDuration = () => TrackPlayer.getDuration();

	constructor() {
		this.list = [];
		this._history = new HistoryList();
	}

	readonly _path = {
		settings: RNFS.DocumentDirectoryPath + '/settings.json',
		musicListsDir: RNFS.DocumentDirectoryPath + '/MusicLists',
		getMusicList: () => {
			let fileName = this.settings.listIndex + '.json';
			return this._path.musicListsDir + '/' + fileName;
		}
	}

	settings = {
		loop: LoopMode.shuffle,
		listsName: ['-'],
		listIndex: 0,
		musicIndex: 0,
		musicPosition: 0,
	}

	async load(){
		if (await RNFS.exists(this._path.settings)){
			let obj = JSON.parse(await RNFS.readFile(this._path.settings));
			for (let key of Object.keys(this.settings)){
				if (key in obj){
					this.settings[key] = obj[key];
				}
			}
		}
		
		let filePath = this._path.getMusicList();
		if (await RNFS.exists(filePath)){
			const json = await RNFS.readFile(filePath);
			this.list = JSON.parse(json);
		}
		else{
			const urls = await GetAllFiles('/storage/emulated/0/Music');
			this.list = urls.map(MakeFile);
			await this.saveList();
		}

		let first = this.list[this.settings.musicIndex];
		this.record(first);
		await this.start(first, true, this.settings.musicPosition);

		setInterval(async ()=>{
			await RNFS.writeFile(this._path.settings, JSON.stringify(this.settings));
		}, 1000);
	}

	async saveList(){
		await RNFS.mkdir(this._path.musicListsDir);
		await RNFS.writeFile(this._path.getMusicList(), JSON.stringify(this.list));
	}

	add(url: string){
		this.list.push(MakeFile(url, this.list.length));
		this.saveList();
	}

	get current(): File{
		return this._history.Cur() || {
			id: -1,
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

	record(file: File){
		this._history.Add(file);
	}

	async start(file: File | undefined, pause: boolean, position: number = 0) {
		if (!file) file = DefaultMusic;
		this.settings.musicIndex = file.id;
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
		if (position > 0){
			TrackPlayer.seekTo(position);
		}
		else if(file.startTime > 0){
			TrackPlayer.seekTo(file.startTime);
		}
		pause || await TrackPlayer.play();
		await TrackPlayer.setVolume(file.volume || 0.8);
		await (this.onStart && this.onStart(file));
	}

	randomNext(){
		let ranges = [];
		let sum = 0;
		this.list.forEach(file=>{
			sum += file.weight;
			ranges.push(sum);
		});
		let rand = Math.random() * sum;
		let result = this.list[0];
		for(let index in ranges){
			if (rand < ranges[index]){
				result = this.list[index];
				break;
			}
		}
		return result;
	}

	async skipToNext(pause?: boolean): Promise<File | void> {
		let file = this._history.Next();
		if (file) {
			await this.start(file, pause);
			return file;
		} else {
			switch(this.settings.loop){
				case LoopMode.noLoop:
					TrackPlayer.pause();
					return;
				case LoopMode.single:
					file = this.current;
					break;
				case LoopMode.order:
					let index = this.current.id;
					index = (index + 1) % this.list.length;
					file = this.list[index];
					break;
				case LoopMode.shuffle:
					file = this.randomNext();
					break;
			}
			this._history.Add(file);
			await this.start(file, pause);
			return file;
		}
	}

	async skipToPrevious(pause?: boolean): Promise<File | void> {
		let file = this._history.Previous();
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
		if (duration > 0) seconds = Math.max(0, Math.min(duration, seconds));
		if (seconds === position) return seconds;
		await TrackPlayer.seekTo(seconds);
		return seconds;
	}
}

//module.exports = new PlayControl();
export default new PlayControl();