import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import Sound from 'react-native-sound';
import AudioRecord from 'react-native-audio-record';
import Slider from '@react-native-community/slider';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const KaraokePlayer = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [backgroundTrack, setBackgroundTrack] = useState(null);
  const [volume, setVolume] = useState(0.8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const [recordingPitches, setRecordingPitches] = useState({});
  const [finishedPlaying, setFinishedPlaying] = useState({});

  useEffect(() => {
    setupAudio();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (backgroundTrack) {
      backgroundTrack.release();
    }
    if (currentlyPlaying) {
      currentlyPlaying.stop();
      currentlyPlaying.release();
    }
    if (isRecording) {
      AudioRecord.stop();
    }
  };

  const checkPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const result = await check(PERMISSIONS.ANDROID.RECORD_AUDIO);
        if (result === RESULTS.GRANTED) return true;
        
        const permissionResult = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
        return permissionResult === RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const setupAudio = async () => {
    const hasPermission = await checkPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Microphone permission is required for karaoke.');
      return;
    }

    // Configure audio recording
    const options = {
      sampleRate: 44100,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      wavFile: 'user_recording.wav'
    };

    AudioRecord.init(options);

    // Initialize background track (All Senoria)
    Sound.setCategory('Playback');
    const track = new Sound('aajkiraat.mp3', Sound.MAIN_BUNDLE, (error) => {
      if (error) {
        console.log('Failed to load the sound', error);
        Alert.alert('Error', 'Failed to load background track');
        return;
      }
      // Sound loaded successfully
      setBackgroundTrack(track);
    });
  };

  const startRecording = async () => {
    if (!backgroundTrack) {
      Alert.alert('Error', 'Background track not loaded yet');
      return;
    }

    try {
      await AudioRecord.start();
      backgroundTrack.play((success) => {
        if (!success) {
          Alert.alert('Playback Error', 'Failed to play background track');
        }
        setIsPlaying(false);
      });
      setIsRecording(true);
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    try {
      const audioFile = await AudioRecord.stop();
      backgroundTrack.stop();
      setIsRecording(false);
      setIsPlaying(false);
      
      const newRecordingId = Date.now();
      const newRecording = {
        id: newRecordingId,
        path: audioFile,
        name: `Recording ${recordings.length + 1}`,
      };

      // Initialize pitch for this recording
      setRecordingPitches(prev => ({
        ...prev,
        [newRecordingId]: 0
      }));
      
      setRecordings([...recordings, newRecording]);
      console.log('Recording saved:', audioFile);
      Alert.alert('Success', 'Recording saved successfully!');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const playRecording = (recording) => {
    if (currentlyPlaying) {
      currentlyPlaying.stop();
      currentlyPlaying.release();
      setCurrentlyPlaying(null);
      setCurrentPlayingId(null);
    }

    setFinishedPlaying(prev => ({
      ...prev,
      [recording.id]: false
    }));

    const pitch = recordingPitches[recording.id] || 0;
    const sound = new Sound(recording.path, '', (error) => {
      if (error) {
        console.log('Failed to load recording', error);
        Alert.alert('Error', 'Failed to load recording');
        return;
      }

      try {
        sound.setPitch(Math.pow(2, pitch / 12));
        sound.setVolume(volume);
        
        // Set numberOfLoops to 0 to play only once
        sound.setNumberOfLoops(0);
        
        sound.play((success) => {
          if (success) {
            console.log('Successfully finished playing');
            setIsPaused(true);
            setCurrentlyPlaying(null);
            setCurrentPlayingId(null);
            setFinishedPlaying(prev => ({
              ...prev,
              [recording.id]: true
            }));
          } else {
            console.log('Playback failed due to audio decoding errors');
          }
        });

        setCurrentlyPlaying(sound);
        setCurrentPlayingId(recording.id);
        setIsPaused(false);
      } catch (err) {
        console.error('Error during playback setup:', err);
        Alert.alert('Error', 'Failed to setup playback');
      }
    });
  };

  const deleteRecording = (recordingId) => {
    // Stop the audio if it's currently playing
    if (currentlyPlaying && currentPlayingId === recordingId) {
      currentlyPlaying.stop();
      currentlyPlaying.release();
      setCurrentlyPlaying(null);
      setCurrentPlayingId(null);
      setIsPaused(false);
    }

    // Remove the recording from all state
    setRecordings(recordings.filter(rec => rec.id !== recordingId));
    setRecordingPitches(prev => {
      const newPitches = { ...prev };
      delete newPitches[recordingId];
      return newPitches;
    });
    setFinishedPlaying(prev => {
      const newFinished = { ...prev };
      delete newFinished[recordingId];
      return newFinished;
    });
  };

  const togglePlayPause = (recording) => {
    if (currentlyPlaying && currentPlayingId === recording.id) {
      if (isPaused) {
        // When resuming, make sure to set numberOfLoops to 0
        currentlyPlaying.setNumberOfLoops(0);
        currentlyPlaying.play((success) => {
          if (success) {
            setIsPaused(true);
            setCurrentlyPlaying(null);
            setCurrentPlayingId(null);
            setFinishedPlaying(prev => ({
              ...prev,
              [recording.id]: true
            }));
          }
        });
        setIsPaused(false);
      } else {
        currentlyPlaying.pause();
        setIsPaused(true);
      }
    } else {
      playRecording(recording);
    }
  };

  const getPlayButtonText = (recordingId) => {
    if (finishedPlaying[recordingId]) {
      return ' Play Again';
    }
    if (currentPlayingId === recordingId) {
      return isPaused ? ' Resume' : ' Pause';
    }
    return ' Play';
  };

  const adjustPitch = (recordingId, value) => {
    setRecordingPitches(prev => ({
      ...prev,
      [recordingId]: value
    }));

    // If this recording is currently playing, update its pitch
    if (currentlyPlaying && currentPlayingId === recordingId) {
      try {
        currentlyPlaying.setPitch(Math.pow(2, value / 12));
      } catch (err) {
        console.error('Error adjusting pitch:', err);
      }
    }
  };

  const handleVolumeChange = (value) => {
    setVolume(value);
    if (backgroundTrack) {
      backgroundTrack.setVolume(value);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Karaoke Player</Text>
      
      <TouchableOpacity
        style={[styles.button, isRecording && styles.buttonActive]}
        onPress={isRecording ? stopRecording : startRecording}
      >
        <Text style={styles.buttonText}>
          {isRecording ? 'Stop' : 'Start'} Recording
        </Text>
      </TouchableOpacity>

      <View style={styles.volumeContainer}>
        <Text style={styles.volumeText}>Background Music Volume</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={volume}
          onValueChange={handleVolumeChange}
          minimumTrackTintColor="#1DB954"
          maximumTrackTintColor="#000000"
        />
      </View>

      {isPlaying && (
        <Text style={styles.statusText}>
          Recording in progress...
        </Text>
      )}

      <View style={styles.recordingsList}>
        <Text style={styles.recordingsTitle}>Saved Recordings</Text>
        {recordings.map((recording) => (
          <View key={recording.id} style={styles.recordingItem}>
            <View style={styles.recordingInfo}>
              <Text style={styles.recordingName}>{recording.name}</Text>
              <View style={styles.pitchControl}>
                <Text style={styles.pitchText}>
                  Pitch: {recordingPitches[recording.id] || 0} semitones
                </Text>
                <Slider
                  style={styles.pitchSlider}
                  minimumValue={-12}
                  maximumValue={12}
                  value={recordingPitches[recording.id] || 0}
                  step={1}
                  onValueChange={(value) => adjustPitch(recording.id, value)}
                  minimumTrackTintColor="#1DB954"
                  maximumTrackTintColor="#000000"
                />
              </View>
            </View>
            <View style={styles.recordingControls}>
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  currentPlayingId === recording.id && !isPaused && styles.activeButton,
                  finishedPlaying[recording.id] && styles.playAgainButton
                ]}
                onPress={() => togglePlayPause(recording)}
              >
                <Text style={styles.controlButtonText}>
                  {getPlayButtonText(recording.id)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlButton, styles.deleteButton]}
                onPress={() => deleteRecording(recording.id)}
              >
                <Text style={styles.controlButtonText}> Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#1DB954',
  },
  button: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 30,
    elevation: 3,
  },
  buttonActive: {
    backgroundColor: '#E74C3C',
  },
  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  volumeContainer: {
    width: '100%',
    marginBottom: 20,
  },
  volumeText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#666',
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  statusText: {
    marginTop: 20,
    color: '#1DB954',
    fontSize: 16,
    fontWeight: '500',
  },
  recordingsList: {
    width: '100%',
    marginTop: 20,
  },
  recordingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  recordingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingName: {
    fontSize: 16,
    marginBottom: 4,
  },
  recordingControls: {
    flexDirection: 'row',
  },
  controlButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: '#1DB954',
    borderRadius: 4,
  },
  deleteButton: {
    backgroundColor: '#FF4136',
  },
  controlButtonText: {
    color: '#fff',
  },
  activeButton: {
    backgroundColor: '#157a3b',
  },
  playAgainButton: {
    backgroundColor: '#4CAF50',
  },
  pitchControl: {
    marginTop: 8,
    width: '100%',
  },
  pitchSlider: {
    width: '100%',
    height: 40,
  },
  pitchText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
});

export default KaraokePlayer;
