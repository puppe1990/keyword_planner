"use client"

import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

type KeywordData = {
  Keyword: string
  avgMonthlySearches: number
  competition: number
  topPageBidLow: number
  topPageBidHigh: number
}

type AnalysisConfig = {
  topKeywords: {
    count: number
    minSearches: number
  }
  nicheKeywords: {
    count: number
    minSearches: number
    maxSearches: number
    maxCompetition: number
  }
  lowBidKeywords: {
    count: number
    maxBidPercentile: number
    minSearchPercentile: number
  }
}

const defaultConfig: AnalysisConfig = {
  topKeywords: {
    count: 10,
    minSearches: 1000
  },
  nicheKeywords: {
    count: 10,
    minSearches: 10,
    maxSearches: 500,
    maxCompetition: 50
  },
  lowBidKeywords: {
    count: 10,
    maxBidPercentile: 50,
    minSearchPercentile: 50
  }
}

export function KeywordAnalysisDashboardComponent() {
  const [data, setData] = useState<KeywordData[] | null>(null)
  const [topKeywords, setTopKeywords] = useState<KeywordData[] | null>(null)
  const [nicheKeywords, setNicheKeywords] = useState<KeywordData[] | null>(null)
  const [lowBidKeywords, setLowBidKeywords] = useState<KeywordData[] | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [fileName, setFileName] = useState('')

  const [analysisConfig, setAnalysisConfig] = useState<AnalysisConfig>(defaultConfig)
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set())

  const [showChart, setShowChart] = useState<'top' | 'niche' | 'lowBid' | null>(null)

  const processData = (fileContent: string) => {
    const lines = fileContent.split('\n').slice(2) // Skip first two lines
    const headers = lines[0].split('\t')
    const rawData = lines.slice(1).map(line => {
      const values = line.split('\t')
      return headers.reduce<Record<string, string>>((obj, header, index) => {
        obj[header.trim()] = values[index]
        return obj
      }, {})
    })

    const cleanedData: KeywordData[] = rawData.map(row => ({
      Keyword: row['Keyword'],
      avgMonthlySearches: parseInt(row['Avg. monthly searches']?.replace(/,/g, '') || '0', 10),
      competition: parseFloat(row['Competition (indexed value)'] || '0'),
      topPageBidLow: parseFloat(row['Top of page bid (low range)']?.replace(',', '.') || '0'),
      topPageBidHigh: parseFloat(row['Top of page bid (high range)']?.replace(',', '.') || '0')
    })).filter(row => !isNaN(row.avgMonthlySearches) && !isNaN(row.topPageBidHigh))

    setData(cleanedData)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = (e) => processData(e.target?.result as string)
      reader.readAsText(file)
    }
  }

  const median = (arr: number[]) => {
    const mid = Math.floor(arr.length / 2)
    const nums = [...arr].sort((a, b) => a - b)
    return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
  }

  const handleConfigChange = (section: keyof AnalysisConfig, field: string, value: number) => {
    setAnalysisConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }))

    const fieldKey = `${section}.${field}`
    if (value !== defaultConfig[section][field]) {
      setModifiedFields(prev => new Set(prev).add(fieldKey))
    } else {
      setModifiedFields(prev => {
        const newSet = new Set(prev)
        newSet.delete(fieldKey)
        return newSet
      })
    }
  }

  const analyzeKeywords = () => {
    if (!data || data.length === 0) return

    setIsAnalyzing(true)
    
    // Top keywords analysis
    const sortedKeywords = [...data]
      .filter(row => row.avgMonthlySearches >= analysisConfig.topKeywords.minSearches)
      .sort((a, b) => b.avgMonthlySearches - a.avgMonthlySearches)
    setTopKeywords(sortedKeywords.slice(0, analysisConfig.topKeywords.count))

    // Niche keywords analysis
    const nicheKeywords = data.filter(
      row => row.avgMonthlySearches >= analysisConfig.nicheKeywords.minSearches &&
             row.avgMonthlySearches <= analysisConfig.nicheKeywords.maxSearches &&
             row.competition < analysisConfig.nicheKeywords.maxCompetition
    )
    setNicheKeywords(nicheKeywords.slice(0, analysisConfig.nicheKeywords.count))

    // Low bid keywords analysis
    const sortedBySearches = [...data].sort((a, b) => a.avgMonthlySearches - b.avgMonthlySearches)
    const sortedByBid = [...data].sort((a, b) => a.topPageBidHigh - b.topPageBidHigh)
    
    const searchIndex = Math.min(Math.floor(sortedBySearches.length * analysisConfig.lowBidKeywords.minSearchPercentile / 100), sortedBySearches.length - 1)
    const bidIndex = Math.min(Math.floor(sortedByBid.length * analysisConfig.lowBidKeywords.maxBidPercentile / 100), sortedByBid.length - 1)
    
    const searchThreshold = sortedBySearches[searchIndex]?.avgMonthlySearches ?? 0
    const bidThreshold = sortedByBid[bidIndex]?.topPageBidHigh ?? Infinity

    const lowBidKeywords = data.filter(
      row => row.topPageBidHigh < bidThreshold && row.avgMonthlySearches > searchThreshold
    ).sort((a, b) => b.avgMonthlySearches - a.avgMonthlySearches)
    setLowBidKeywords(lowBidKeywords.slice(0, analysisConfig.lowBidKeywords.count))

    setIsAnalyzing(false)
  }

  const renderInput = (section: keyof AnalysisConfig, field: string, label: string) => {
    const fieldKey = `${section}.${field}`
    const isModified = modifiedFields.has(fieldKey)

    return (
      <div className="relative mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {isModified && <span className="text-blue-500 ml-1">*</span>}
        </label>
        <Input
          type="number"
          value={analysisConfig[section][field as keyof typeof analysisConfig[typeof section]]}
          onChange={(e) => handleConfigChange(section, field, parseInt(e.target.value))}
          className={`${isModified ? 'border-blue-500' : ''} bg-white`}
        />
        {isModified && (
          <p className="text-xs text-gray-500 mt-1">
            Default: {defaultConfig[section][field as keyof typeof defaultConfig[typeof section]]}
          </p>
        )}
      </div>
    )
  }

  const downloadCSV = (data: KeywordData[], filename: string) => {
    const headers = Object.keys(data[0]).join(',')
    const csv = [
      headers,
      ...data.map(row => Object.values(row).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const renderTable = (data: KeywordData[] | null, title: string) => {
    if (!data) return null
    return (
      <Card className="mb-8 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{title}</h2>
            <div>
              <Button onClick={() => downloadCSV(data, `${title.toLowerCase().replace(' ', '_')}.csv`)}
                      className="bg-white text-blue-600 hover:bg-blue-100">
                Download CSV
              </Button>
              <Button className="ml-2 bg-white text-purple-600 hover:bg-purple-100"
                      onClick={() => setShowChart(title.toLowerCase().replace(' ', '') as 'top' | 'niche' | 'lowBid')}>
                View Chart
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keyword</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Monthly Searches</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Competition</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Top Page Bid (Low)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Top Page Bid (High)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-6 py-4 whitespace-nowrap">{row.Keyword}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{row.avgMonthlySearches}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{row.competition}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{row.topPageBidLow}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{row.topPageBidHigh}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderChart = (data: KeywordData[] | null, type: 'top' | 'niche' | 'lowBid') => {
    if (!data || data.length === 0) return null;

    const chartData = data.map(item => ({
      Keyword: item.Keyword,
      "Avg. Monthly Searches": item.avgMonthlySearches,
      "Top Page Bid (High)": item.topPageBidHigh
    }));

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg w-11/12 max-w-4xl shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">{type.charAt(0).toUpperCase() + type.slice(1)} Keywords Chart</h2>
            <Button onClick={() => setShowChart(null)} className="bg-red-500 hover:bg-red-600 text-white">Close</Button>
          </div>
          <div className="h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="Keyword" angle={-45} textAnchor="end" height={80} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar dataKey="Avg. Monthly Searches" fill="hsl(215, 70%, 60%)" yAxisId="left" />
                {type === 'lowBid' && <Bar dataKey="Top Page Bid (High)" fill="hsl(280, 60%, 65%)" yAxisId="right" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-100 min-h-screen">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">Keyword Analysis Dashboard</h1>
      <Card className="mb-8 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-400 to-blue-500 text-white">
          <h2 className="text-2xl font-semibold">Upload and Analyze</h2>
        </CardHeader>
        <CardContent className="bg-white">
          <div className="flex items-center space-x-4 mb-4">
            <Input type="file" onChange={handleFileUpload} accept=".csv" className="flex-grow bg-gray-50" />
            <Button onClick={analyzeKeywords} disabled={!data || isAnalyzing}
                    className="bg-blue-500 hover:bg-blue-600 text-white">
              {isAnalyzing ? 'Analyzing...' : 'Analyze Keywords'}
            </Button>
          </div>
          {fileName && <p className="text-sm text-gray-600">Uploaded file: {fileName}</p>}
        </CardContent>
      </Card>
      
      <Card className="mb-8 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
          <h2 className="text-2xl font-semibold">Analysis Configuration</h2>
        </CardHeader>
        <CardContent className="bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-3 text-lg text-gray-700">Top Keywords</h3>
              {renderInput('topKeywords', 'count', 'Count')}
              {renderInput('topKeywords', 'minSearches', 'Min Searches')}
            </div>
            <div>
              <h3 className="font-semibold mb-3 text-lg text-gray-700">Niche Keywords</h3>
              {renderInput('nicheKeywords', 'count', 'Count')}
              {renderInput('nicheKeywords', 'minSearches', 'Min Searches')}
              {renderInput('nicheKeywords', 'maxSearches', 'Max Searches')}
              {renderInput('nicheKeywords', 'maxCompetition', 'Max Competition')}
            </div>
            <div>
              <h3 className="font-semibold mb-3 text-lg text-gray-700">Low Bid Keywords</h3>
              {renderInput('lowBidKeywords', 'count', 'Count')}
              {renderInput('lowBidKeywords', 'maxBidPercentile', 'Max Bid Percentile')}
              {renderInput('lowBidKeywords', 'minSearchPercentile', 'Min Search Percentile')}
            </div>
          </div>
        </CardContent>
      </Card>

      {renderTable(topKeywords, "Top Keywords")}
      {renderTable(nicheKeywords, "Niche Keywords")}
      {renderTable(lowBidKeywords, "Low Bid Keywords")}
      
      {showChart && renderChart(
        showChart === 'top' ? topKeywords :
        showChart === 'niche' ? nicheKeywords :
        lowBidKeywords,
        showChart
      )}
    </div>
  )
}