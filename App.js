//#region import
import React, { Component } from 'react';
import { 
  StyleSheet, 
  View, Text, 
  ScrollView, FlatList, 
  TouchableOpacity, TouchableWithoutFeedback, TouchableHighlight
} from 'react-native';
import TrackPlayer from "react-native-track-player"; //https://react-native-track-player.js.org/
const RNFS = require('react-native-fs');
import RNFileSelector from 'react-native-file-selector'; //https://github.com/prscX/react-native-file-selector
import Controls from './controls';
import localTrack from "./resources/pure.m4a";
//#endregion

export default class App extends Component {
  //#region Base
  constructor(props) {
    super(props);
    this.state = {
      playback: '',
      log: '',
      duration: 0,
      position: 0,
      jumpStep: 5,
      files: [],
      curFile: {},
      playOrder: 2,
    };
  }

  styles = StyleSheet.create({
    main: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30
    },
    title: {
      height: 200,
      fontSize: 36,
      textAlign: 'center',
      textAlignVertical: 'center'
    },
    control: {
      flexDirection: "row",
      width: '100%',
      justifyContent: 'space-between'
    },
    footer: {
      flexDirection: 'row',
    },
  })

  render() {
    return (
      <View style={{flex:1}}>
        <View style={this.styles.main}>
          <Text style={this.styles.title}>{this.state.curFile.title}</Text>

          <ProgressBar
            position={this.state.position}
            duration={this.state.duration}
            jump={this.jumpByRate}
            log={this.log}
          ></ProgressBar>

          <View style={this.styles.control}>
            <ControlButton
              title={"I◀"} textStyle={{letterSpacing: -3}}
              onPress={this.previous}
            />
            <ControlButton 
              title={"«"} textStyle={{fontWeight: 'bold'}} 
              onPress={this.jumpBackwards}
            />
            <ControlButton 
              title={this.getToggleButtonIcon()} textStyle={{letterSpacing: -10}}
              onPress={this.toggle} 
            />
            <ControlButton 
              title={"»"} textStyle={{fontWeight: 'bold'}}
              onPress={this.jumpForwards}
            />
            <ControlButton 
              title={"▶I"} textStyle={{letterSpacing: -3}} 
              onPress={this.next}
            />
          </View>
        </View>
        
        
        <View style={this.styles.footer}>
          <FooterButton
            onPress={()=>{
              const newOrder = (this.state.playOrder + 1) % 3;
              this.setState({playOrder: newOrder});
              this.log(this.playOrder[newOrder][1])
            }}
            title={this.playOrder[this.state.playOrder][0]}
            color="#3a3"
          />
          <FooterButton
            onPress={()=>{
              this.modal.show(JSON.stringify(this.state, null, '  '));
            }}
            title='log'
            color="#841584"
          />
          <FooterButton
            onPress={()=>this.selectFile()}
            title="+"
            color="#fa3"
          />
          <FooterButton 
            onPress={this.showPlayList.bind(this)}
            title={"≡"}
            color="#aaa"
          />
        </View>

        <PlayList
          ref={ref => this.playList = ref}
          start={(index)=>Controls.start(index)}
          list={this.state.files}
          index={this.state.curFile.id}
        ></PlayList>
        <Hint ref={ref => this.hint = ref}></Hint>
        <Modal ref={ref => this.modal = ref}></Modal>
      </View>
    );
  }

  componentDidMount() {
    this.init();
  }

  async init(){
    await TrackPlayer.setupPlayer({});
    TrackPlayer.updateOptions({
      stopWithApp: true,
      capabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
        TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
        TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
        TrackPlayer.CAPABILITY_JUMP_FORWARD,
        TrackPlayer.CAPABILITY_JUMP_BACKWARD,
        TrackPlayer.CAPABILITY_STOP
      ],
      compactCapabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
        TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
        TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
      ]
    });

    TrackPlayer.addEventListener('playback-state', (args) => {
      this.setState({playback: args.state});
    });
    TrackPlayer.addEventListener('playback-error', (args) => {
      this.log(args);
    });

    const urls = await this.GetAllFiles('/storage/emulated/0/Music');
    const files = urls.map((url, index)=>({
      url,
      title: this.getTitle(url),
      id: index
    }));
    if (!files){
      files.push({
        id: 0,
        title: 'pure',
        url: localTrack
      });
    }

    Controls.list = files;
    Controls.getPosition = () => this.state.position;
    Controls.getDuration = () => this.state.duration;
    Controls.onStart = async file => {
      this.setState({curFile: file});
      this.setState({
        duration: await TrackPlayer.getDuration(),
        position: 0
      });
    };
    Controls.skipToNext(true);

    this.timerID = setInterval(
      () => this.tick(),
      100
    );
  }

  async tick() {
    if (this.state.playback !== TrackPlayer.STATE_PLAYING) return;
    this.setState({
      position: await TrackPlayer.getPosition()
    });
  }

  log = obj => {
    let msg = obj.constructor === String ? obj : JSON.stringify(obj);
    this.setState({log: msg});
    this.hint.show(msg, 2000);
  }
  //#endregion

  //#region File
  getTitle(url){
    return url.match(/.*\/(.*)\.\w+$/)[1];
  }

  selectFile(){
    RNFileSelector.Show({
      title: '选择音乐文件',
      //filter: '.*\.mp3$',
      onDone: (url) => {
        console.log(url);
        const files = this.state.files;
        if (files.some(file=>file.url===url)) return;
        files.push({
          url,
          title: this.getTitle(url),
          id: files.length
        });
      },
      onCancel: () => {
        this.log('cancelled');
      }
    })
  }

  async GetAllFiles(dir){
    let items = await RNFS.readDir(dir);
    let urls = items
      .filter(item=>item.isFile())
      .map(item=>item.path)
      .filter(path=>['mp3','aac','wav'].includes((path.match(/\.(\w+)$/)||[])[1]));
    return urls;
  }
  //#endregion

  //#region Control
  async jumpTo(pos){
    this.setState({position: await Controls.jumpTo(pos)})
  }

  jumpByRate = rate => this.jumpTo(this.state.duration * rate);

  jumpForwards = () => this.jumpTo(this.state.position + this.state.jumpStep);

  jumpBackwards = () => this.jumpTo(this.state.position - this.state.jumpStep);
  
  toggle = () => Controls.toggle();

  next = () => Controls.skipToNext();

  previous = () => Controls.skipToPrevious() || this.log('已是第一首');
  //#endregion
  
  //#region UI
  getStateName(state) {
    state = state || this.state.playback;
    switch (state) {
      case TrackPlayer.STATE_NONE:
        return "未找到资源";
      case TrackPlayer.STATE_PLAYING:
        return "播放中";
      case TrackPlayer.STATE_PAUSED:
        return "已暂停";
      case TrackPlayer.STATE_STOPPED:
        return "已结束";
      case TrackPlayer.STATE_BUFFERING:
      case TrackPlayer.STATE_CONNECTING:
        return "缓冲中";
      case TrackPlayer.STATE_READY:
        return "就绪";
    }
    return state.toString();
  }

  getToggleButtonIcon(){
    switch (this.state.playback) {
      case TrackPlayer.STATE_PLAYING:
        return "┃┃";
      case TrackPlayer.STATE_PAUSED:
      case TrackPlayer.STATE_STOPPED:
      case TrackPlayer.STATE_READY:
        return "▶";
    }
    return ''; //☒
  }

  playOrder=[
    ['↻', '顺序播放'],
    ['₰', '随机播放'],
    ['➀', '单曲循环']
  ]

  showPlayList(){
    this.playList.show(Controls.list, Controls.current.id);
  }
  //#endregion
}

//#region Components
class ProgressBar extends Component{
  constructor(props) {
    super(props)
    this.state = {
      width: Infinity,
    }
  }

  styles = StyleSheet.create({
    container:{
      marginVertical: 20,
      flexDirection: "row"
    },
    text:{
    },
    barContainer:{
      flex: 1,
      marginHorizontal: 10
    },
    bar:{
      flexDirection: "row",
      height:20,
      borderRadius: 8,
      backgroundColor: '#eee',
      alignItems: 'center',
      overflow: 'hidden',
    },
    barFront:{ 
      backgroundColor: "#f55", 
      height: '100%', 
    },
    barBack:{
      backgroundColor: "#ddd",
      height: '100%'
    }
  });

  formatTime(seconds){
    seconds = Math.round(seconds);
    let minute = Math.floor(seconds/60);
    seconds = seconds%60;
    return `${minute<10 ? '0' : ''}${minute}:${seconds<10 ? '0' : ''}${seconds}`;
  }

  onPressOut = (event) => this.props.duration > 0 && this.props.jump(event.nativeEvent.locationX/this.state.width);

  onLayout = (event) => this.setState({width: event.nativeEvent.layout.width});
  
  render(){
    const { position, duration } = this.props;
    return(
      <View style={this.styles.container}>
        <Text style={this.styles.text}>
          {this.formatTime(position)}
        </Text>
        <Pressable style={this.styles.barContainer} onPressOut={this.onPressOut}>
          <View style={this.styles.bar}  onLayout={this.onLayout}>
            <View style={Object.assign({flex: duration > 0 ? position : 0}, this.styles.barFront)}/>
            <View style={Object.assign({flex: Math.max(duration - position, 1)}, this.styles.barBack)}/>
          </View>
        </Pressable>
        <Text style={this.styles.text}>
          {duration>0 ? this.formatTime(duration) : '??:??'}
        </Text>
      </View>
    );
  }
}

class Pressable extends Component{
  //为了保证触摸事件的target为注册事件的节点而不是其子节点（否则无法获得正确的location），只得采取absolute遮盖的方式

  constructor(props) {
    super(props)
  }

  render() {
    let {style, onPressOut} = this.props;
    return (
      <View style={Object.assign({
        position:'relative',
      }, style)}>
        {this.props.children}
        <View
          style={{
            position:'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            backgroundColor:'transparent', //如果没有这项，触摸事件就不会触发，怀疑是被“优化”掉了
          }}
          onStartShouldSetResponder={()=>true}
          //onResponderStart={(event)=>console.log(event.nativeEvent)}
          //onResponderMove={(event)=>console.log(event.nativeEvent)}
          onResponderEnd={onPressOut}
        ></View>
      </View>
    )
  }
}

function FooterButton({ title, onPress, color }){
  return (
    <TouchableOpacity style={{
      padding: 7,
      backgroundColor: color || '#2196f3',
      alignItems: 'center',
      flex:1
    }} onPress={onPress}>
      <Text style={{
        color: '#fff',
        fontSize: 20,
      }}>{title}</Text>
    </TouchableOpacity>
  );
}

function ControlButton({ title, onPress, color, textStyle }) {
  return (
    <TouchableOpacity style={{
      padding: 5,
      borderRadius: 2,
      backgroundColor: color || '#2196f3',
      minWidth: 45,
      alignItems: 'center'
    }} onPress={onPress}>
      <Text style={Object.assign({
        color: '#fff',
        fontSize: 25,
        minWidth: 25,
        textAlign: 'center'
      }, textStyle)}>{title}</Text>
    </TouchableOpacity>
  );
}

class Modal extends Component{
  constructor(props) {
    super(props)
    this.state = {
      show: false,
      text: ''
    }
  }

  show(text){
    this.setState({
      show: true,
      text
    });
  }

  render() {
    return this.state.show && (
      <View
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          zIndex: 9,
          top: 0,
          left: 0,
        }}
      >
        <ScrollView
          style={{
            backgroundColor: 'white',
          }}
          contentContainerStyle={{
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{
            backgroundColor: 'white',
            textAlignVertical: 'center',
          }} selectable={true}>{this.state.text}</Text>
        </ScrollView>
        <TouchableOpacity style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width:30,
          height:30,
          backgroundColor:'red',
        }} onPress={()=>{
          this.setState({show: false, text:'1'});
        }}>
          <Text style={{
            textAlign: 'center',
            textAlignVertical: 'center',
            fontSize: 20,
          }}>X</Text>
        </TouchableOpacity>
      </View>
    )
  }
}

class Hint extends Component{
  constructor(props) {
    super(props)
    this.state = {
      show: false,
      text: '',
      timer: null
    }
  }

  show(text, ms){
    if (this.state.timer) clearTimeout(this.state.timer);
    this.setState({
      show: true,
      text,
      timer: setTimeout(()=>{this.setState({show: false})}, ms)
    });
  }

  render() {
    return this.state.show && (
      <View style={{
        width: '100%',
        height: '20%',
        position: 'absolute',
        zIndex: 10,
        top: 0,
        left: 0,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text
          style={{
            backgroundColor: '#eee',
            color: '#444',
            textAlign: 'center',
            textAlignVertical: 'center',
            padding: 10,
            borderRadius: 5
          }}
        >{this.state.text}</Text>
      </View>
    )
  }
}

class PlayList extends Component{
  constructor(props) {
    super(props)
    this.state = {
      show: false,
    }
  }

  styles = StyleSheet.create({
    container: {
      width: '100%',
      height: '100%',
      position: 'absolute',
      zIndex: 8,
      top: 0,
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.5)'
    },
    blankArea: {
      flex:1
    },
    visualArea: {
      height: '60%',
      margin: 20,
      padding: 20,
      borderRadius: 10,
      backgroundColor: '#fff'
    },
    button: {
      flex: 1,
      height: 50
    },
    buttonTitle: {
      textAlignVertical: 'center',
      fontSize: 16,
      flex: 1,
    },
  });

  show(list, index){
    this.setState({show: true});
    this.list = list;
    this.index = index;
  }

  hide(){
    this.setState({show: false});
  }

  shouldComponentUpdate(nextProps, nextState){
    return nextState.show !== this.state.show;
  }

  render() {
    const {list, index} = this;
    const play = (index)=>{
      this.props.start(index);
      this.hide();
    }
    const renderItem = ({item: file}) => (
      <TouchableHighlight
        style={this.styles.button}
        underlayColor='#eee'
        onPress={()=>play(file.id)}
      >
        <Text style={Object.assign({color: file.id === index ? '#f33': '#000'}, this.styles.buttonTitle)}>
          {file.title}
        </Text>
      </TouchableHighlight>
    );
    return this.state.show && (
      <View style={this.styles.container}>
        <TouchableWithoutFeedback onPress={()=>this.hide()}>
          <View style={this.styles.blankArea}></View>
        </TouchableWithoutFeedback>
        <View style={this.styles.visualArea} >
          <FlatList
            data={list}
            renderItem={renderItem}
            keyExtractor={file => file.id.toString()}
            extraData={index}
            getItemLayout={(data, index)=>({
              length: 50,
              offset: 50 * index,
              index
            })}
            initialScrollIndex={Math.max(0, index-1)}
          />
        </View>
      </View>
    )
  }
}

class MusicInfo extends Component{
  constructor(props) {
    super(props)
    this.state = {
      show: false,
    }
  }

  styles = StyleSheet.create({
    container: {
      width: '100%',
      height: '100%',
      position: 'absolute',
      zIndex: 8,
      top: 0,
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.5)'
    },
    blankArea: {
      flex:1
    },
    visualArea: {
      height: '60%',
      margin: 20,
      padding: 20,
      borderRadius: 10,
      backgroundColor: '#fff'
    },
    button: {
      flex: 1,
      height: 50
    },
    buttonTitle: {
      textAlignVertical: 'center',
      fontSize: 16,
      flex: 1,
    },
  });

  show(){
    this.setState({show: true});
  }

  hide(){
    this.setState({show: false});
  }

  shouldComponentUpdate(nextProps, nextState){
    return nextState.show !== this.state.show;
  }

  render() {
    const {list, index} = this.props;
    const play = (index)=>{
      this.props.start(index);
      this.hide();
    }
    const renderItem = ({item: file}) => (
      <TouchableHighlight
        style={this.styles.button}
        underlayColor='#eee'
        onPress={()=>play(file.id)}
      >
        <Text style={Object.assign({color: file.id === index ? '#f33': '#000'}, this.styles.buttonTitle)}>
          {file.title}
        </Text>
      </TouchableHighlight>
    );
    return this.state.show && (
      <View style={this.styles.container}>
        <TouchableWithoutFeedback onPress={()=>this.hide()}>
          <View style={this.styles.blankArea}></View>
        </TouchableWithoutFeedback>
        <View style={this.styles.visualArea} >
          <FlatList
            data={list}
            renderItem={renderItem}
            keyExtractor={file => file.id.toString()}
            extraData={index}
            getItemLayout={(data, index)=>({
              length: 50,
              offset: 50 * index,
              index
            })}
            initialScrollIndex={Math.max(0, index-1)}
          />
        </View>
      </View>
    )
  }
}
//#endregion

