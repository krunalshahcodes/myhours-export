const axios = require('axios')
const { startOfMonth, endOfMonth, format } = require('date-fns')
const fs = require('fs')
const { groupBy, map, sumBy } = require('lodash')
const jsonexport = require('jsonexport')
require('dotenv').config()

const convertNumToTime = (number) => {
  // Check sign of given number
  var sign = number >= 0 ? 1 : -1

  // Set positive value of number of sign negative
  number = number * sign

  // Separate the int from the decimal part
  var hour = Math.floor(number)
  var decpart = number - hour

  var min = 1 / 60
  // Round to nearest minute
  decpart = min * Math.round(decpart / min)

  var minute = Math.floor(decpart * 60) + ''

  // Add padding if need
  if (minute.length < 2) {
    minute = '0' + minute
  }

  // Add Sign in final result
  sign = sign == 1 ? '' : '-'

  // Concate hours and minutes and seconds
  time = sign + hour + ':' + minute + ':00'

  return time
}

const login = async () => {
  const res = await axios.post(`https://api2.myhours.com/api/tokens/login`, {
    grantType: 'password',
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    clientId: 'api',
  })

  return res.data
}

const getAllProjects = async (auth) => {
  const res = await axios.get(`https://api2.myhours.com/api/Projects/getAll`, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: 'application/json',
    },
  })
  return res.data
}

const getAllTimeLogs = async (auth, from, to) => {
  const res = await axios.get(`https://api2.myhours.com/api/Reports/activity`, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: 'application/json',
    },
    params: {
      DateFrom: from ? from : startOfMonth(new Date()),
      DateTo: to ? to : endOfMonth(new Date()),
    },
  })
  return res.data
}

const exportLogs = async (from, to) => {
  const auth = await login()
  const projects = await getAllProjects(auth)
  const logs = await getAllTimeLogs(auth, from, to)
  // console.log(logs)
  await Promise.all(
    projects.map(async (project) => {
      let projectLogs = logs.filter(function (log) {
        if (log.projectId === project.id && log.tags !== 'Overtime') {
          return log
        }
      })
      projectLogs = projectLogs.map((log) => ({
        Date: format(new Date(log.date), 'dd-MM-yyyy'),
        Description: `${log.taskName} ${log.note !== null ? log.note : ''}`,
        Hours: log.billableHours,
      }))
      const groupped = groupBy(projectLogs, 'Date')
      projectLogs = map(groupped, function (items) {
        return {
          Date: items[0].Date,
          Description: items[0].Description,
          Hours: convertNumToTime(sumBy(items, 'Hours')),
        }
      })

      jsonexport(projectLogs, function (err, csv) {
        if (err) return console.error(err)
        fs.writeFileSync(`logs/${project.name}.csv`, csv, 'binary')
      })
    })
  )
}

const exportExtraLogs = async (from, to) => {
  const auth = await login()
  const projects = await getAllProjects(auth)
  let logs = await getAllTimeLogs(auth, from, to)
  logs = logs.filter(function (log) {
    if (log.tags === 'Overtime') {
      return log
    }
  })
  logs = logs.map((log) => ({
    Date: format(new Date(log.date), 'dd-MM-yyyy'),
    Description: `${log.taskName} ${log.note !== null ? log.note : ''}`,
    Hours: convertNumToTime(log.billableHours),
  }))
  jsonexport(logs, function (err, csv) {
    if (err) return console.error(err)
    fs.writeFileSync(`logs/Extra.csv`, csv, 'binary')
  })
}
exportLogs('2022-12-01', '2022-12-04')
exportExtraLogs('2022-12-01', '2022-12-04')
