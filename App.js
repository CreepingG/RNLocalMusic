//#region import
import React, { Component } from 'react';
import { 
  StyleSheet, 
  View, Text, TextInput, 
  ScrollView, FlatList, 
  TouchableOpacity, TouchableWithoutFeedback, TouchableHighlight,
  Alert
} from 'react-native';
import TrackPlayer from "react-native-track-player"; //https://react-native-track-player.js.org/
import RNFileSelector from 'react-native-file-selector'; //https://github.com/prscX/react-native-file-selector
import Controls from './controls';
import controls from './controls';
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
      title: '',
      loopMode: 3,
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
 
    Controls.getPosition = () => this.state.position;
    Controls.getDuration = () => this.state.duration;
    Controls.onStart = async file => {
      this.setState({title: file.title});
      let duration = file.duration || await TrackPlayer.getDuration();
      this.setState({
        duration,
        position: await TrackPlayer.getPosition()
      });
      if (duration === 0){
        setTimeout(() => {
          TrackPlayer.getDuration().then(duration => this.setState({duration}));
        }, 100);
      }
    };
    await Controls.load();
    this.setState({loopMode: Controls.settings.loop});
    TrackPlayer.addEventListener('playback-queue-ended', ({track, position}) => {
      let file = Controls.current;
      if (!'duration' in file){
        file.duration = position;
      }
      Controls.skipToNext();
    });

    this.timerID = setInterval(
      () => this.tick(),
      100
    );
  }
  
  async tick() {
    if (this.state.playback !== TrackPlayer.STATE_PLAYING) return;
    let position = await TrackPlayer.getPosition();
    controls.settings.musicPosition = position;
    let endTime = Controls.current.endTime;
    if (endTime > 0 && position >= endTime){
      Controls.skipToNext();
    }
    else{
      this.setState({
        position
      });
    }
  }

  log = obj => {
    let msg = obj.constructor === String ? obj : JSON.stringify(obj);
    this.setState({log: msg});
    this.hint.show(msg, 2000);
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

  previous = () => Controls.skipToPrevious().then(result=>result||this.log('已是第一首'));
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

  loopMode=[
    ['▣', '播完即止'],
    ['↻', '顺序播放'],
    ['₰', '随机播放'],
    ['➀', '单曲循环']
  ]

  showPlayList(){
    this.playList.show(Controls.list, Controls.current.id);
  }

  selectFile(){
    RNFileSelector.Show({
      title: '选择音乐文件',
      //filter: '.*\.mp3$',
      onDone: (url) => {
        console.log(url);
        if (Controls.list.some(file=>file.url===url)) return;
        Controls.add(url);
      },
      onCancel: () => {
        this.log('cancelled');
      }
    })
  }
  //#endregion
  
  render() {
    return (
      <View style={{flex:1}}>
        <View style={this.styles.main}>
          <Text style={this.styles.title}>{this.state.title}</Text>

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
              const newMode = (this.state.loopMode + 1) % 4;
              this.setState({loopMode: newMode});
              Controls.settings.loop = newMode;
              this.log(this.loopMode[newMode][1])
            }}
            title={this.loopMode[this.state.loopMode][0]}
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
            onPress={()=>{
              this.musicConfig.show(Controls.current);
            }}
            title='config'
            color="#3dd"
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
          start={(index)=>{
            let file = Controls.list[index];
            Controls.record(file);
            Controls.start(file);
          }}
        ></PlayList>
        <Hint ref={ref => this.hint = ref}></Hint>
        <Modal ref={ref => this.modal = ref}></Modal>
        <MusicConfig 
          ref={ref => this.musicConfig = ref}
          onSubmit={() => {
            this.setState({title: Controls.current.title});
            controls.saveList();
          }}
        ></MusicConfig>
      </View>
    );
  }
}

//#region Components
function FormatTime(seconds){
  seconds = Math.round(seconds);
  let minute = Math.floor(seconds/60);
  seconds = seconds%60;
  return `${minute<10 ? '0' : ''}${minute}:${seconds<10 ? '0' : ''}${seconds}`;
}

function ParseTime(text){
  try{
    let [_, min, sec] = text.match(/(\d+):(\d\d(\.\d+)?)/);
    return ToNumber(min) * 60 + ToNumber(sec);
  }
  catch{
    throw new Error(`"${text}"不是有效的时间`);
  }
}

function ToNumber(s){
  let n = Number(s);
  if (isNaN(n)) throw new Error(`"${s}"不是数字`);
  return n;
}

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

  onPressOut = (event) => this.props.duration > 0 && this.props.jump(event.nativeEvent.locationX/this.state.width);

  onLayout = (event) => this.setState({width: event.nativeEvent.layout.width});
  
  render(){
    const { position, duration } = this.props;
    return(
      <View style={this.styles.container}>
        <Text style={this.styles.text}>
          {FormatTime(position)}
        </Text>
        <Pressable style={this.styles.barContainer} onPressOut={this.onPressOut}>
          <View style={this.styles.bar}  onLayout={this.onLayout}>
            <View style={{flex: duration > 0 ? position : 0, ...this.styles.barFront}}/>
            <View style={{flex: Math.max(duration - position, 1), ...this.styles.barBack}}/>
          </View>
        </Pressable>
        <Text style={this.styles.text}>
          {duration>0 ? FormatTime(duration) : '??:??'}
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
      <View style={{
        position:'relative',
        ...style
      }}>
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
      <Text style={{
        color: '#fff',
        fontSize: 25,
        minWidth: 25,
        textAlign: 'center',
        ...textStyle
      }}>{title}</Text>
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

  listEmptyComponent = (
    <Text style={{textAlign:'center'}}>列表为空</Text>
  )

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
        <Text style={{color: file.id === index ? '#f33': '#000', ...this.styles.buttonTitle}}>
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
            ListEmptyComponent={this.listEmptyComponent}
          />
        </View>
      </View>
    )
  }
}

class MusicConfig extends Component{
  constructor(props) {
    super(props)
    this.state = {
      show: false,
      params: {title:'aciabviabvuajbdviaydhfnaujksfbagbiagb'}
    }
  }

  styles = StyleSheet.create({
    container: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      padding: 20,
      zIndex: 8,
      top: 0,
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
    },
    visualArea: {
      width: '100%',
      padding: 20,
      borderRadius: 10,
      backgroundColor: '#fff'
    },
    line: {
      height: 60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around'
    },
    lineTitle: {
      width: 65,
      textAlign: 'center',
    },
    lineContent: {
      width: '60%',
      flexDirection: 'row',
      alignContent: 'center'
    },
    input: {
      flex: 1,
      padding: 0,
      textAlign: 'center',
      borderColor: '#888',
      borderStyle: 'solid',
      borderWidth: 1,
    },
    buttonLine: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: 10
    },
    button: {
      fontSize: 22,
      backgroundColor: '#aee',
      borderRadius: 5,
      padding: 8
    }
  });

  show(file){
    this.setState({show: true});
    this.file = file;
    let params = {};
    for (let pair of Object.entries(file)){
      if (pair[0].endsWith('Time')) pair[1] = FormatTime(pair[1]);
      params[pair[0]] = pair[1].toString();
    }
    this.setState({params});
  }

  hide = () => this.setState({show: false});

  submit = ()=>{
    const params = this.state.params;
    const file = this.file;
    try{
      file.title = params.title;
      file.weight = ToNumber(params.weight);
      file.volume = ToNumber(params.volume);
      file.startTime = ParseTime(params.startTime);
      file.endTime = ParseTime(params.endTime);
      this.props.onSubmit(file);
      this.hide();
    }
    catch(err){
      Alert.alert('提交失败', err.message);
    }
  }

  render() {
    return this.state.show && (
      <View style={this.styles.container}>
        <View style={this.styles.visualArea}>
          <ScrollView>
            <View style={this.styles.line}>
              <Text style={this.styles.lineTitle}>标题</Text>
              <View style={this.styles.lineContent}>
                <TextInput
                  style={this.styles.input}
                  value={this.state.params.title}
                  onChangeText={text => this.setState({
                    params: {...this.state.params, title: text}
                  })}
                  multiline={true}
                ></TextInput>
              </View>
            </View>
            <View style={this.styles.line}>
              <Text style={this.styles.lineTitle}>随机权重</Text>
              <View style={this.styles.lineContent}>
                <TextInput
                  style={this.styles.input}
                  value={this.state.params.weight}
                  onChangeText={text => this.setState({
                    params: {...this.state.params, weight: text}
                  })}
                ></TextInput>
              </View>
            </View>
            <View style={this.styles.line}>
              <Text style={this.styles.lineTitle}>音量[0,1]</Text>
              <View style={this.styles.lineContent}>
                <TextInput
                  style={this.styles.input}
                  value={this.state.params.volume}
                  onChangeText={text => this.setState({
                    params: {...this.state.params, volumes: text}
                  })}
                ></TextInput>
              </View>
            </View>
            <View style={this.styles.line}>
              <Text style={this.styles.lineTitle}>播放区间</Text>
              <View style={this.styles.lineContent}>
                <TextInput
                  style={this.styles.input}
                  value={this.state.params.startTime}
                  onChangeText={text => this.setState({
                    params: {...this.state.params, startTime: text}
                  })}
                ></TextInput>
                <Text style={{width: 20, textAlign: 'center', textAlignVertical: 'center'}}>~</Text>
                <TextInput
                  style={this.styles.input}
                  value={this.state.params.endTime}
                  onChangeText={text => this.setState({
                    params: {...this.state.params, endTime: text}
                  })}
                ></TextInput>
              </View>
            </View>
            <View style={this.styles.buttonLine}>
              <TouchableHighlight
                onPress={this.submit}
              >
                <Text style={this.styles.button}>提交</Text>
              </TouchableHighlight>
              <TouchableHighlight
                onPress={this.hide}
              >
                <Text style={this.styles.button}>取消</Text>
              </TouchableHighlight>
            </View>
          </ScrollView>
        </View>
      </View>
    )
  }
}
//#endregion

