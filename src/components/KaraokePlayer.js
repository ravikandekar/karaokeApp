import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
  ScrollView,
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
    try {
      if (backgroundTrack) {
        backgroundTrack.stop();
        backgroundTrack.release();
      }
      if (currentlyPlaying) {
        currentlyPlaying.stop();
        currentlyPlaying.release();
      }
      if (isRecording) {
        AudioRecord.stop();
      }
      setIsRecording(false);
      setIsPlaying(false);
      setCurrentlyPlaying(null);
      setCurrentPlayingId(null);
    } catch (error) {
      console.error('Error in cleanup:', error);
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
    try {
      if (currentlyPlaying) {
        currentlyPlaying.stop();
        currentlyPlaying.release();
        setCurrentlyPlaying(null);
        setCurrentPlayingId(null);
      }

      const hasPermission = await checkPermission();
      if (!hasPermission) return;

      const options = {
        sampleRate: 44100,
        channels: 2,
        bitsPerSample: 16,
        audioSource: 6,
        wavFile: `recording-${Date.now()}.wav`
      };

      AudioRecord.init(options);
      AudioRecord.start();

      // Start background track if it exists
      if (backgroundTrack) {
        backgroundTrack.play();
        backgroundTrack.setVolume(volume);
      }

      setIsRecording(true);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    try {
      const audioFile = await AudioRecord.stop();
      if (backgroundTrack) {
        backgroundTrack.stop();
      }
      setIsRecording(false);
      setIsPlaying(false);
      
      const newRecordingId = Date.now().toString();
      const newRecording = {
        id: newRecordingId,
        path: audioFile,
        name: `Recording ${recordings.length + 1}`,
      };

      setRecordingPitches(prev => ({
        ...prev,
        [newRecordingId]: 0
      }));
      
      setRecordings(prevRecordings => [...prevRecordings, newRecording]);
      console.log('Recording saved:', audioFile);
      Alert.alert('Success', 'Recording saved successfully!');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const playRecording = (recording) => {
    try {
      if (currentlyPlaying) {
        currentlyPlaying.stop();
        currentlyPlaying.release();
        setCurrentlyPlaying(null);
        setCurrentPlayingId(null);
      }

      if (isRecording) {
        Alert.alert('Warning', 'Please stop recording before playing');
        return;
      }

      setFinishedPlaying(prev => ({
        ...prev,
        [recording.id]: false
      }));

      const sound = new Sound(recording.path, '', (error) => {
        if (error) {
          console.error('Failed to load recording:', error);
          Alert.alert('Error', 'Failed to load recording');
          return;
        }

        try {
          sound.setPitch(Math.pow(2, (recordingPitches[recording.id] || 0) / 12));
          sound.setVolume(volume);
          sound.setNumberOfLoops(-1);
          
          sound.play((success) => {
            if (!success) {
              console.error('Playback failed');
              setCurrentlyPlaying(null);
              setCurrentPlayingId(null);
              setFinishedPlaying(prev => ({
                ...prev,
                [recording.id]: true
              }));
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
    } catch (error) {
      console.error('Error in playRecording:', error);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const togglePlayPause = (recording) => {
    if (currentlyPlaying && currentPlayingId === recording.id) {
      if (isPaused) {
        currentlyPlaying.setNumberOfLoops(-1); // Set to loop continuously when resuming
        currentlyPlaying.play((success) => {
          if (!success) {
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

  const stopPlayback = (recording) => {
    if (currentlyPlaying && currentPlayingId === recording.id) {
      currentlyPlaying.stop();
      setCurrentlyPlaying(null);
      setCurrentPlayingId(null);
      setIsPaused(false);
      setFinishedPlaying(prev => ({
        ...prev,
        [recording.id]: true
      }));
    }
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
      <Text style={styles.title}>🎤 Karaoke Player</Text>
      
      <TouchableOpacity
        style={[styles.mainButton, isRecording && styles.mainButtonActive]}
        onPress={isRecording ? stopRecording : startRecording}
      >
        <Text style={styles.mainButtonText}>
          {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
        </Text>
      </TouchableOpacity>

      <View style={styles.volumeContainer}>
        <Text style={styles.sectionTitle}>🔊 Background Music Volume</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={volume}
          onValueChange={handleVolumeChange}
          minimumTrackTintColor="#1DB954"
          maximumTrackTintColor="#E0E0E0"
          thumbTintColor="#1DB954"
        />
      </View>

      {isPlaying && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            🎤 Recording in progress...
          </Text>
          <View style={styles.recordingIndicator} />
        </View>
      )}

      <View style={styles.recordingsList}>
        <Text style={styles.sectionTitle}>📝 Saved Recordings</Text>
        <ScrollView style={styles.scrollView}>
          {recordings.map((recording) => (
            <View key={recording.id} style={styles.recordingCard}>
              <View style={styles.recordingHeader}>
                <Text style={styles.recordingName}>{recording.name}</Text>
                <TouchableOpacity
                  style={[styles.deleteButton]}
                  onPress={() => deleteRecording(recording.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.pitchControl}>
                <Text style={styles.pitchText}>
                  🎵 Pitch: {recordingPitches[recording.id] || 0} semitones
                </Text>
                <Slider
                  style={styles.pitchSlider}
                  minimumValue={-12}
                  maximumValue={12}
                  value={recordingPitches[recording.id] || 0}
                  step={1}
                  onValueChange={(value) => adjustPitch(recording.id, value)}
                  minimumTrackTintColor="#1DB954"
                  maximumTrackTintColor="#E0E0E0"
                  thumbTintColor="#1DB954"
                />
              </View>

              <View style={styles.controlsContainer}>
                <TouchableOpacity
                  style={[
                    styles.playButton,
                    currentPlayingId === recording.id && !isPaused && styles.activeButton,
                    finishedPlaying[recording.id] && styles.playAgainButton
                  ]}
                  onPress={() => togglePlayPause(recording)}
                >
                  <Text style={styles.buttonText}>
                    {getPlayButtonText(recording.id)}
                  </Text>
                </TouchableOpacity>

                {currentPlayingId === recording.id && !isPaused && (
                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={() => stopPlayback(recording)}
                  >
                    <Text style={styles.buttonText}>⏹️ Stop</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#2C3E50',
    letterSpacing: 0.5,
  },
  mainButton: {
    backgroundColor: '#1DB954',
    padding: 16,
    borderRadius: 30,
    marginBottom: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  mainButtonActive: {
    backgroundColor: '#DC3545',
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#2C3E50',
    letterSpacing: 0.3,
  },
  volumeContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statusText: {
    color: '#DC3545',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC3545',
    opacity: 1,
    animationName: 'pulse',
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
  },
  recordingsList: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  recordingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordingName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
  },
  deleteButtonText: {
    fontSize: 20,
  },
  pitchControl: {
    marginBottom: 16,
  },
  pitchText: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 8,
  },
  pitchSlider: {
    width: '100%',
    height: 40,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  playButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  activeButton: {
    backgroundColor: '#157a3b',
  },
  stopButton: {
    backgroundColor: '#DC3545',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  playAgainButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default KaraokePlayer;
