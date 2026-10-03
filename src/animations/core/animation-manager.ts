import gsap from 'gsap'
export const motion = { duration: 0.64, ease: 'power3.inOut', depthX: -7, depthScale: 0.97 }
export class AnimationManager {
  private timeline?: gsap.core.Timeline
  private complete?: () => void
  play(build: (timeline: gsap.core.Timeline) => void, reduced: boolean, cleanup?: () => void): Promise<void> {
    this.finish()
    return new Promise((resolve, reject) => {
      let settled = false
      const complete = () => {
        if (settled) return
        settled = true
        if (this.timeline === timeline) { this.timeline = undefined; this.complete = undefined }
        cleanup?.()
        resolve()
      }
      const timeline = gsap.timeline({
        paused: true,
        defaults: { duration: reduced ? 0 : motion.duration, ease: motion.ease },
        onComplete: complete,
      })
      this.timeline = timeline
      this.complete = complete
      try {
        build(timeline)
        timeline.play()
        // Empty plans and reduced-motion list updates must resolve synchronously.
        if (timeline.totalDuration() === 0) { timeline.totalProgress(1); complete() }
      }
      catch (error) {
        timeline.kill(); settled = true
        if (this.timeline === timeline) { this.timeline = undefined; this.complete = undefined }
        cleanup?.(); reject(error)
      }
    })
  }
  finish() { this.timeline?.totalProgress(1) }
  dispose() { this.timeline?.kill(); this.complete?.(); this.timeline = undefined; this.complete = undefined }
}


