# Pomodorox

A personal time tracker that runs focused work and break intervals against a prioritised list of things to do.

## Language

### Tasks

**Task**:
A single thing to do on the list, with a name, an Estimate and a Pomodoro Count; its Priority is its place in the list.
_Avoid_: Todo, entry, item

**Priority**:
A Task's position in the list: the higher a Task sits, the more important it is. There are no priority levels.
_Avoid_: Priority level, rank, importance

**Done**:
The state of a Task the user has finished; a Done Task leaves the list but can be brought back.
_Avoid_: Completed (reserved for Sessions), finished, closed, archived

**Estimate**:
The number of Pomodoros planned for a Task.
_Avoid_: Planned pomodoros, budget

**Pomodoro Count**:
The number of Pomodoros completed for a Task.
_Avoid_: Used pomodoros, spent, actual

**Active Task**:
The one Task a Work Session is for; it is chosen before the Session starts and stays fixed until it ends.
_Avoid_: Current task, selected task, focus

### Timer

**Session**:
One run of the timer, of exactly one Session Kind.
_Avoid_: Interval, timer run, pomodoro (for breaks)

**Session Kind**:
The type of a Session: Work (25 min), Short Break (5 min) or Long Break (15 min).
_Avoid_: Mode, phase

**Pomodoro**:
A Work Session that ran to completion. Breaks and Abandoned Work Sessions are not Pomodoros.
_Avoid_: Using "pomodoro" for any Session

**Abandoned Session**:
A Session stopped before its full duration elapsed; it never counts toward a Pomodoro Count.
_Avoid_: Cancelled, interrupted, failed session

### History

**Event**:
A timestamped record of something that happened, such as a Session starting or ending.
_Avoid_: Log entry, activity, action

**Event Log**:
The chronological list of Events shown to the user.
_Avoid_: History table, activity feed, journal
