import test from "node:test";
import assert from "node:assert/strict";
import { audioTime, audioPosition, audioDuration } from "../src/lib/audio-playback.ts";

test("audio timestamps remain readable for short recordings, long files and unavailable metadata",()=>{
  assert.equal(audioTime(4.9),"0:04");assert.equal(audioTime(61),"1:01");assert.equal(audioTime(3600),"60:00");
  for(const value of [-1,NaN,Infinity]) assert.equal(audioTime(value),"0:00");
});
test("seeking cannot exceed the recording or seek into invalid metadata",()=>{
  assert.equal(audioPosition(6,4),4);assert.equal(audioPosition(-1,4),0);assert.equal(audioPosition(2.4,4),2.4);
  assert.equal(audioPosition(2,Infinity),0);assert.equal(audioPosition(NaN,4),0);
});
test("recordings with initially unknown duration remain usable when seekable metadata or the final duration arrives",()=>{
  const media={duration:NaN,currentTime:0,ended:false,seekable:{length:0,start:()=>0,end:()=>4}};
  assert.equal(audioDuration(media),0);
  media.seekable.length=1;assert.equal(audioDuration(media),4);
  media.duration=Infinity;assert.equal(audioDuration(media),4);
  media.ended=true;media.currentTime=4.2;assert.equal(audioDuration(media),4.2);
  media.duration=10;assert.equal(audioDuration(media),10);
});
