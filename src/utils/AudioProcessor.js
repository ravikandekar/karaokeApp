import TrackPlayer from 'react-native-track-player';

export class AudioProcessor {
  constructor() {
    this.setup();
  }

  async setup() {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.updateOptions({
      capabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
        TrackPlayer.CAPABILITY_STOP,
      ],
      compactCapabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
      ],
    });
  }

  async processAudio(audioPath, pitch) {
    try {
      // Reset the player
      await TrackPlayer.reset();

      // Add the track
      await TrackPlayer.add({
        url: audioPath,
        title: 'Recorded Audio',
        artist: 'User',
        // Apply pitch shift using the native audio engine
        pitchAlgorithm: 'SONIC',
        pitch: Math.pow(2, pitch / 12), // Convert semitones to pitch multiplier
      });

      return true;
    } catch (error) {
      console.error('Error processing audio:', error);
      return false;
    }
  }

  async play() {
    try {
      await TrackPlayer.play();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  async pause() {
    try {
      await TrackPlayer.pause();
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  }

  async stop() {
    try {
      await TrackPlayer.stop();
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  }

  async setVolume(volume) {
    try {
      await TrackPlayer.setVolume(volume);
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }
}

export default new AudioProcessor();
