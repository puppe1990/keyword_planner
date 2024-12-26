"use client"

import React, { useState, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeftIcon, ChevronRightIcon, ArrowUpIcon, ArrowDownIcon } from '@radix-ui/react-icons'

// Remove unused imports
// import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

type KeywordData = {
  Keyword: string
  avgMonthlySearches: number
  competition: number
  topPageBidLow: number
  topPageBidHigh: number
  intention: string
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
    count: 1000,
    minSearches: 1000
  },
  nicheKeywords: {
    count: 1000,
    minSearches: 10,
    maxSearches: 500,
    maxCompetition: 100
  },
  lowBidKeywords: {
    count: 10,
    maxBidPercentile: 50,
    minSearchPercentile: 50
  }
}

type SortColumn = 'Keyword' | 'avgMonthlySearches' | 'competition' | 'topPageBidLow' | 'topPageBidHigh'
type SortDirection = 'asc' | 'desc'

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

  // Add this new state variable
  const [allValidKeywords, setAllValidKeywords] = useState<KeywordData[] | null>(null)

  // Add these new state variables for pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Add this new state variable at the beginning of your component
  const [searchTerm, setSearchTerm] = useState('')

  const [sortColumn, setSortColumn] = useState<SortColumn>('Keyword')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Add these state variables for the All Valid Keywords table
  const [allValidCurrentPage, setAllValidCurrentPage] = useState(1);
  const [allValidSearchTerm, setAllValidSearchTerm] = useState('');
  const [allValidIntentionFilter, setAllValidIntentionFilter] = useState('');
  const [allValidSortColumn, setAllValidSortColumn] = useState<keyof KeywordData>('Keyword');
  const [allValidSortDirection, setAllValidSortDirection] = useState<SortDirection>('asc');
  const [allValidItemsPerPage, setAllValidItemsPerPage] = useState<number | 'all'>(10);

  const processData = useCallback((fileContent: string) => {
    // Split the content into lines and remove any empty lines
    const lines = fileContent.split('\n').filter(line => line.trim() !== '')
    
    // Find the index of the actual header row
    const headerIndex = lines.findIndex(line => line.includes('Keyword') && line.includes('Avg. monthly searches'))
    
    if (headerIndex === -1) {
      console.error('Could not find header row')
      return
    }

    // The header row
    const headers = lines[headerIndex].split('\t')

    // Process all the remaining lines as data
    const rawData = lines.slice(headerIndex + 1).map(line => {
      const values = line.split('\t')
      return headers.reduce<Record<string, string>>((obj, header, index) => {
        obj[header.trim()] = values[index]?.trim() || ''
        return obj
      }, {})
    })

    console.log(`Total rows processed: ${rawData.length}`)
    console.log('Sample raw data:', rawData[0]) // Log the first row of raw data

    const categorizeIntentionExtended = (keyword: string): string => {
      const keywordLower = keyword.toLowerCase();
      
      const transactionalWords = [
        "comprar", "assinar", "adquirir", "preço", "cotação", 
        "promoção", "desconto", "vender", "alugar", "contratar", 
        "oferta", "encomendar", "loja", "valor", "licitar"
      ];
      
      const commercialInvestigationWords = [
        "melhor", "comparar", "review", "avaliação", "diferença", 
        "análise", "testes", "ranking", "top", "benefícios", 
        "prós e contras", "vs", "comparativo", "qual escolher", "recomendações"
      ];
      
      const navigationalWords = [
        "site", "login", "acessar", "entrar", "portal", 
        "www", "endereço", "perfil", "aplicativo", "app", 
        "contato", "telefone", "sac", "email", "suporte"
      ];
      
      const informationalWords = [
        "como", "o que é", "dicas", "guia", "tutoriais", 
        "explicação", "definição", "passo a passo", "aprender", 
        "exemplos", "informações", "manual", "sugestões", "por que", 
        "conceitos", "história de", "significado", "tipos de", "uso"
      ];

      if (transactionalWords.some(word => keywordLower.includes(word))) {
        return "Transacional";
      } else if (commercialInvestigationWords.some(word => keywordLower.includes(word))) {
        return "Investigação Comercial";
      } else if (navigationalWords.some(word => keywordLower.includes(word))) {
        return "Navegacional";
      } else if (informationalWords.some(word => keywordLower.includes(word))) {
        return "Informacional";
      }

      return "Informacional";
    };

    const cleanedData: KeywordData[] = rawData
      .map(row => {
        const topPageBidLow = parseFloat(row['Top of page bid (low range)']?.replace(',', '.') || '0')
        const topPageBidHigh = parseFloat(row['Top of page bid (high range)']?.replace(',', '.') || '0')
        
        const keywordData = {
          Keyword: row['Keyword'] || '',
          avgMonthlySearches: parseInt(row['Avg. monthly searches']?.replace(/[,\.]/g, '') || '0', 10),
          competition: parseFloat(row['Competition (indexed value)']?.replace(',', '.') || '0'),
          topPageBidLow: isNaN(topPageBidLow) ? 0 : topPageBidLow,
          topPageBidHigh: isNaN(topPageBidHigh) ? 0 : topPageBidHigh,
          intention: categorizeIntentionExtended(row['Keyword'] || '') // Add this line
        }
        console.log('Parsed row:', keywordData) // Log each parsed row
        return keywordData
      })
      .filter(row => {
        const isValid = row.Keyword !== '' && 
          !isNaN(row.avgMonthlySearches) && 
          !isNaN(row.competition)
        if (!isValid) {
          console.log('Invalid row:', row) // Log invalid rows
        }
        return isValid
      })

    console.log(`Cleaned data rows: ${cleanedData.length}`)
    if (cleanedData.length > 0) {
      console.log('Sample cleaned data:', cleanedData[0]) // Log the first row of cleaned data
    }

    setData(cleanedData)
    setAllValidKeywords(cleanedData)
  }, [])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result
        if (typeof content === 'string') {
          console.log(`File size: ${content.length} characters`) // Add this line for debugging
          processData(content)
        } else {
          console.error('Failed to read file as string')
        }
      }
      reader.onerror = (e) => {
        console.error('Error reading file:', e)
      }
      reader.readAsText(file)
    }
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
    console.log('Analyzing keywords...');
    if (!data || data.length === 0) {
      console.log('No data to analyze');
      return;
    }

    setIsAnalyzing(true);
    
    // Top keywords analysis
    const sortedKeywords = [...data]
      .filter(row => row.avgMonthlySearches >= analysisConfig.topKeywords.minSearches)
      .sort((a, b) => b.avgMonthlySearches - a.avgMonthlySearches);
    
    const topKeywordsResult = sortedKeywords.slice(0, analysisConfig.topKeywords.count);
    setTopKeywords(topKeywordsResult);
    console.log('Top Keywords:', topKeywordsResult);

    // Niche keywords analysis
    const nicheKeywords = data.filter(row =>
      row.avgMonthlySearches >= analysisConfig.nicheKeywords.minSearches &&
      row.avgMonthlySearches <= analysisConfig.nicheKeywords.maxSearches &&
      row.competition <= analysisConfig.nicheKeywords.maxCompetition
    );
    const nicheKeywordsResult = nicheKeywords
      .sort((a, b) => b.avgMonthlySearches - a.avgMonthlySearches)
      .slice(0, analysisConfig.nicheKeywords.count);
    setNicheKeywords(nicheKeywordsResult);
    console.log('Niche Keywords:', nicheKeywordsResult);

    // Low bid keywords analysis
    const sortedBySearches = [...data].sort((a, b) => a.avgMonthlySearches - b.avgMonthlySearches);
    const sortedByBid = [...data].sort((a, b) => a.topPageBidHigh - b.topPageBidHigh);
    
    const searchIndex = Math.floor(sortedBySearches.length * analysisConfig.lowBidKeywords.minSearchPercentile / 100);
    const bidIndex = Math.floor(sortedByBid.length * analysisConfig.lowBidKeywords.maxBidPercentile / 100);
    
    const searchThreshold = sortedBySearches[searchIndex]?.avgMonthlySearches ?? 0;
    const bidThreshold = sortedByBid[bidIndex]?.topPageBidHigh ?? Infinity;

    const lowBidKeywords = data.filter(
      row => row.topPageBidHigh < bidThreshold && row.avgMonthlySearches > searchThreshold
    ).sort((a, b) => b.avgMonthlySearches - a.avgMonthlySearches);
    const lowBidKeywordsResult = lowBidKeywords.slice(0, analysisConfig.lowBidKeywords.count);
    setLowBidKeywords(lowBidKeywordsResult);
    console.log('Low Bid Keywords:', lowBidKeywordsResult);

    setIsAnalyzing(false);
  }

  // Helper function to calculate median
  const median = (numbers: number[]): number => {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
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
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [intentionFilter, setIntentionFilter] = useState('');
    const [sortColumn, setSortColumn] = useState<keyof KeywordData>('Keyword');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [itemsPerPage, setItemsPerPage] = useState(10);

    if (!data) return null;

    // Filter data based on search term and intention
    const filteredData = data.filter(keyword =>
      keyword.Keyword.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (intentionFilter === '' || keyword.intention === intentionFilter)
    );

    // Sort the filtered data
    const sortedData = [...filteredData].sort((a, b) => {
      if (a[sortColumn] < b[sortColumn]) return sortDirection === 'asc' ? -1 : 1;
      if (a[sortColumn] > b[sortColumn]) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Calculate pagination
    const totalItems = sortedData.length;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = sortedData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Function to change page
    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    // Function to handle sorting
    const handleSort = (column: keyof KeywordData) => {
      if (column === sortColumn) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortColumn(column);
        setSortDirection('asc');
      }
    };

    // Get unique intentions for the dropdown
    const intentions = ['', ...new Set(data.map(item => item.intention))];

    return (
      <Card className="mb-8 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{title}</h2>
            <div>
              <Button 
                onClick={() => downloadCSV(data, `${title.toLowerCase().replace(' ', '_')}.csv`)}
                className="bg-white text-blue-600 hover:bg-blue-100 mr-2"
              >
                Download CSV
              </Button>
              <Button 
                onClick={() => setShowChart(title.toLowerCase().replace(' ', '') as 'top' | 'niche' | 'lowBid')}
                className="bg-white text-purple-600 hover:bg-purple-100"
              >
                View Chart
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex space-x-4">
            <Input
              type="text"
              placeholder="Search keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
            <select
              value={intentionFilter}
              onChange={(e) => setIntentionFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Intentions</option>
              {intentions.map((intention) => (
                <option key={intention} value={intention}>
                  {intention}
                </option>
              ))}
            </select>
            <select
              value={itemsPerPage.toString()}
              onChange={(e) => {
                const value = e.target.value;
                setItemsPerPage(value === 'all' ? 'all' : Number(value));
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="all">Show All</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {(['Keyword', 'avgMonthlySearches', 'competition', 'topPageBidLow', 'topPageBidHigh', 'intention'] as const).map((column) => (
                    <th
                      key={column}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort(column)}
                    >
                      <div className="flex items-center">
                        {column}
                        {sortColumn === column && (
                          sortDirection === 'asc' ? <ArrowUpIcon className="ml-1 h-4 w-4" /> : <ArrowDownIcon className="ml-1 h-4 w-4" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No results found for {title}
                    </td>
                  </tr>
                ) : (
                  currentItems.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-6 py-4 whitespace-nowrap">{row.Keyword}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.avgMonthlySearches}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.competition}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.topPageBidLow}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.topPageBidHigh}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.intention}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col items-center justify-center">
            <div className="mb-2">
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to <span className="font-medium">{Math.min(indexOfLastItem, totalItems)}</span> of{' '}
                <span className="font-medium">{totalItems}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <Button
                  onClick={() => paginate(1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">First</span>
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
                {getPageNumbers(currentPage, totalPages).map((pageNum, index) => (
                  pageNum === '...' ? (
                    <span
                      key={`dots-${index}`}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={pageNum}
                      onClick={() => paginate(Number(pageNum))}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                        pageNum === currentPage ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </Button>
                  )
                ))}
                <Button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  onClick={() => paginate(totalPages)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Last</span>
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
              </nav>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

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

  const sortData = useCallback((data: KeywordData[], column: SortColumn, direction: SortDirection) => {
    return [...data].sort((a, b) => {
      if (a[column] < b[column]) return direction === 'asc' ? -1 : 1
      if (a[column] > b[column]) return direction === 'asc' ? 1 : -1
      return 0
    })
  }, [])

  const sortedKeywords = useCallback((keywords: KeywordData[]) => {
    return sortData(keywords, sortColumn, sortDirection)
  }, [sortData, sortColumn, sortDirection])

  const renderAllValidKeywordsTable = () => {
    if (!allValidKeywords) return null

    // Filter keywords based on search term and intention
    const filteredKeywords = allValidKeywords.filter(keyword =>
      keyword.Keyword.toLowerCase().includes(allValidSearchTerm.toLowerCase()) &&
      (allValidIntentionFilter === '' || keyword.intention === allValidIntentionFilter)
    )

    // Sort the filtered keywords
    const sortedFilteredKeywords = [...filteredKeywords].sort((a, b) => {
      if (a[allValidSortColumn] < b[allValidSortColumn]) return allValidSortDirection === 'asc' ? -1 : 1;
      if (a[allValidSortColumn] > b[allValidSortColumn]) return allValidSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Calculate pagination
    const totalItems = sortedFilteredKeywords.length;
    const indexOfFirstItem = allValidItemsPerPage === 'all' 
      ? 0 
      : (allValidCurrentPage - 1) * Number(allValidItemsPerPage);
    const indexOfLastItem = allValidItemsPerPage === 'all'
      ? totalItems
      : Math.min(indexOfFirstItem + Number(allValidItemsPerPage), totalItems);
    const currentItems = sortedFilteredKeywords.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = allValidItemsPerPage === 'all' 
      ? 1 
      : Math.ceil(totalItems / Number(allValidItemsPerPage));

    // Function to change page
    const paginate = (pageNumber: number) => setAllValidCurrentPage(pageNumber);

    // Function to handle sorting
    const handleSort = (column: keyof KeywordData) => {
      if (column === allValidSortColumn) {
        setAllValidSortDirection(allValidSortDirection === 'asc' ? 'desc' : 'asc')
      } else {
        setAllValidSortColumn(column)
        setAllValidSortDirection('asc')
      }
    }

    // Get unique intentions for the dropdown
    const intentions = ['', ...new Set(allValidKeywords.map(item => item.intention))];

    // Get all headers from the first item
    const headers = currentItems.length > 0 ? Object.keys(currentItems[0]) : []

    return (
      <Card className="mb-8 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-500 to-teal-600 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Valid Keywords</h2>
            <Button onClick={() => downloadCSV(allValidKeywords, 'all_valid_keywords.csv')}
                    className="bg-white text-green-600 hover:bg-green-100">
              Download CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex space-x-4">
            <Input
              type="text"
              placeholder="Search keywords..."
              value={allValidSearchTerm}
              onChange={(e) => setAllValidSearchTerm(e.target.value)}
              className="w-full"
            />
            <select
              value={allValidIntentionFilter}
              onChange={(e) => setAllValidIntentionFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Intentions</option>
              {intentions.map((intention) => (
                <option key={intention} value={intention}>
                  {intention}
                </option>
              ))}
            </select>
            <select
              value={allValidItemsPerPage.toString()}
              onChange={(e) => {
                const value = e.target.value;
                setAllValidItemsPerPage(value === 'all' ? 'all' : Number(value));
                setAllValidCurrentPage(1);
              }}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="all">Show All</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort(header as keyof KeywordData)}
                    >
                      <div className="flex items-center">
                        {header}
                        {allValidSortColumn === header && (
                          allValidSortDirection === 'asc' ? <ArrowUpIcon className="ml-1 h-4 w-4" /> : <ArrowDownIcon className="ml-1 h-4 w-4" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentItems.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    {headers.map((header) => (
                      <td key={header} className="px-6 py-4 whitespace-nowrap">
                        {row[header as keyof KeywordData]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col items-center justify-center">
            <div className="mb-2">
              <p className="text-sm text-gray-700">
                {allValidItemsPerPage === 'all' ? (
                  `Showing all ${totalItems} results`
                ) : (
                  `Showing ${totalItems === 0 ? 0 : indexOfFirstItem + 1} to ${Math.min(indexOfLastItem, totalItems)} of ${totalItems} results`
                )}
              </p>
            </div>
            {allValidItemsPerPage !== 'all' && (
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <Button
                  onClick={() => paginate(1)}
                  disabled={allValidCurrentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">First</span>
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  onClick={() => paginate(allValidCurrentPage - 1)}
                  disabled={allValidCurrentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
                {getPageNumbers(allValidCurrentPage, totalPages).map((pageNum, index) => (
                  pageNum === '...' ? (
                    <span
                      key={`dots-${index}`}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={pageNum}
                      onClick={() => paginate(Number(pageNum))}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                        pageNum === allValidCurrentPage ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </Button>
                  )
                ))}
                <Button
                  onClick={() => paginate(allValidCurrentPage + 1)}
                  disabled={allValidCurrentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  onClick={() => paginate(totalPages)}
                  disabled={allValidCurrentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Last</span>
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </Button>
              </nav>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // First, add this pagination helper function at the component level
  const getPageNumbers = (currentPage: number, totalPages: number) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-100 min-h-screen">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">Keyword Analysis Dashboard</h1>
      
      {/* File upload card */}
      <Card className="mb-8 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-400 to-blue-500 text-white">
          <h2 className="text-2xl font-semibold">Upload and Analyze</h2>
        </CardHeader>
        <CardContent className="bg-white">
          <div className="flex items-center space-x-4 mb-4">
            <Input type="file" onChange={handleFileUpload} accept=".csv" className="flex-grow bg-gray-50" />
            <Button 
              onClick={analyzeKeywords} 
              disabled={!data || isAnalyzing}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Keywords'}
            </Button>
          </div>
          {fileName && <p className="text-sm text-gray-600">Uploaded file: {fileName}</p>}
        </CardContent>
      </Card>
      
      {/* Analysis configuration card */}
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

      {/* Top Keywords, Niche Keywords, and Low Bid Keywords tables */}
      {renderTable(topKeywords, "Top Keywords")}
      {renderTable(nicheKeywords, "Niche Keywords")}
      {renderTable(lowBidKeywords, "Low Bid Keywords")}

      {/* All Valid Keywords table */}
      {renderAllValidKeywordsTable()}
      
      {/* Chart modal */}
      {showChart && renderChart(
        showChart === 'top' ? topKeywords :
        showChart === 'niche' ? nicheKeywords :
        lowBidKeywords,
        showChart
      )}
    </div>
  )
}
