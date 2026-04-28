// Helper for regulated session calculation
export function calculateRegulatedSession(
  clockInLog: AttendanceLog, 
  clockOutLog: AttendanceLog | null, 
  shift?: ShiftAssignment,
  otStatus: string = "none",
  approvedOtMins: number = 0,
  allDayOts: OvertimeRequest[] = []
) {
  const clockIn = clockInLog.timestamp
  let clockOut = clockOutLog?.timestamp || null
  
  let effectiveOtStatus = otStatus
  if (effectiveOtStatus === 'none' && (clockInLog.status === 'approved' || clockInLog.status === 'rejected')) {
    effectiveOtStatus = clockInLog.status
  }
  
  const cIn = new Date(clockIn)
  let cOut = clockOut ? new Date(clockOut) : new Date()
  let isAutoClockOut = false

  let shiftStart: Date | null = null
  let shiftEnd: Date | null = null

  if (shift) {
    shiftStart = new Date(`${shift.date}T${shift.start_time}`)
    shiftEnd = new Date(`${shift.date}T${shift.end_time}`)
    if (shift.end_time <= shift.start_time) {
      shiftEnd.setDate(shiftEnd.getDate() + 1)
    }
  }

  let maxEnd: Date | null = null
  if (shift && shiftEnd) {
    maxEnd = new Date(shiftEnd.getTime() + 15 * 60000)
    if (effectiveOtStatus === 'approved' && approvedOtMins > 0) {
      const otEnd = new Date(Math.max(cIn.getTime(), shiftEnd.getTime()) + approvedOtMins * 60000)
      if (otEnd > maxEnd) maxEnd = otEnd
    }
  } else if (effectiveOtStatus === 'approved' && approvedOtMins > 0) {
    maxEnd = new Date(cIn.getTime() + approvedOtMins * 60000)
  } else {
    maxEnd = new Date(cIn.getTime() + 8 * 60 * 60000)
  }

  if (maxEnd && cOut > maxEnd) {
    cOut = maxEnd
    isAutoClockOut = true
    clockOut = cOut.toISOString()
  }
  
  const totalMins = Math.max(0, Math.round((cOut.getTime() - cIn.getTime()) / 60000))
  
  let regMins = 0
  let otMins = 0
  let isLate = false
  let lateMinutes = 0
  let isPenalty = false

  if (shift && shiftStart && shiftEnd) {
    const delay = Math.round((cIn.getTime() - shiftStart.getTime()) / 60000)
    if (delay > 0) {
      isLate = true
      lateMinutes = delay
      if (delay > 15) isPenalty = true
    }

    const effectiveStartForReg = new Date(Math.max(cIn.getTime(), shiftStart.getTime()))
    const effectiveEndForReg = new Date(Math.min(cOut.getTime(), shiftEnd.getTime()))
    
    if (effectiveEndForReg > effectiveStartForReg) {
      regMins = Math.round((effectiveEndForReg.getTime() - effectiveStartForReg.getTime()) / 60000)
      regMins = Math.min(regMins, 480)
    }

    const preShiftStart = cIn
    const preShiftEnd = new Date(Math.min(cOut.getTime(), shiftStart.getTime()))
    if (preShiftEnd > preShiftStart) {
      const preMins = Math.round((preShiftEnd.getTime() - preShiftStart.getTime()) / 60000)
      if (effectiveOtStatus === 'approved') otMins += preMins
    }

    const postShiftStart = new Date(Math.max(cIn.getTime(), shiftEnd.getTime()))
    const postShiftEnd = cOut
    if (postShiftEnd > postShiftStart) {
      const postMins = Math.round((postShiftEnd.getTime() - postShiftStart.getTime()) / 60000)
      if (effectiveOtStatus === 'approved') otMins += postMins
    }
  } else {
    if (effectiveOtStatus === 'approved') otMins = totalMins
  }

  return {
    clockIn,
    clockOut,
    minutes: totalMins,
    regularMinutes: regMins,
    overtimeMinutes: otMins,
    isLate,
    lateMinutes,
    isPenalty,
    isAutoClockOut,
    otStatus: effectiveOtStatus,
    shift: shift,
    method: clockInLog?.method || clockOutLog?.method,
    deviceInfo: clockInLog?.device_info || clockOutLog?.device_info,
    ipAddress: clockInLog?.ip_address || clockOutLog?.ip_address,
    outletId: clockInLog?.outlet_id || clockOutLog?.outlet_id
  }
}
