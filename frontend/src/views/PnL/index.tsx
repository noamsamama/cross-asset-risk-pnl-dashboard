import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Container, Stack, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'

type QualityIssue = {
  severity: 'ERROR' | 'WARNING'
  code: string
  count: number
  entity_ids: string[]
  message: string
}

type Trade = {
  trade_id: string
  book_id: string
  trader_id: string
  trade_date: string
  asset_class: string
  product_type: string
  instrument_description: string
  currency: string
  notional: number
  direction: string
  maturity_date: string
}

type TradesResponse = {
  as_of_date: string
  count: number
  issues: QualityIssue[]
  trades: Trade[]
}

const columns: GridColDef<Trade>[] = [
  { field: 'trade_id', headerName: 'Trade', width: 105 },
  { field: 'book_id', headerName: 'Book', width: 105 },
  { field: 'trader_id', headerName: 'Trader', width: 100 },
  { field: 'asset_class', headerName: 'Asset class', width: 115 },
  { field: 'product_type', headerName: 'Product', width: 120 },
  { field: 'instrument_description', headerName: 'Instrument', flex: 1, minWidth: 220 },
  { field: 'currency', headerName: 'CCY', width: 75 },
  { field: 'notional', headerName: 'Notional', type: 'number', width: 140 },
  { field: 'direction', headerName: 'Direction', width: 105 },
  { field: 'maturity_date', headerName: 'Maturity', width: 115 },
]

export default function PnlView() {
  const [data, setData] = useState<TradesResponse>()
  const [error, setError] = useState('')
  const [selectedIssue, setSelectedIssue] = useState<QualityIssue>()

  useEffect(() => {
    fetch('/api/trades')
      .then((response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`)
        return response.json()
      })
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const visibleTrades = selectedIssue
    ? data?.trades.filter((trade) => selectedIssue.entity_ids.includes(trade.trade_id))
    : data?.trades

  return (
    <Container component="main" maxWidth={false} sx={{ py: 3 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4">Positions &amp; P&amp;L</Typography>
          <Typography color="text.secondary">
            {data ? `As of ${data.as_of_date}` : 'Loading trades…'}
          </Typography>
        </Box>
        {data && <Chip label={`${visibleTrades?.length ?? 0} of ${data.count} trades`} />}
      </Stack>

      {error && <Alert severity="error">Could not load trades: {error}</Alert>}

      {data && (
        <>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {data.issues.map((issue) => (
              <Alert
                key={issue.code}
                severity={issue.severity === 'ERROR' ? 'error' : 'warning'}
                action={
                  <Button color="inherit" size="small" onClick={() => setSelectedIssue(issue)}>
                    View trades
                  </Button>
                }
              >
                {issue.message} ({issue.count})
              </Alert>
            ))}
          </Stack>

          {selectedIssue && (
            <Chip
              label={`Filtered by ${selectedIssue.code}`}
              onDelete={() => setSelectedIssue(undefined)}
              sx={{ mb: 2 }}
            />
          )}

          <DataGrid
            rows={visibleTrades ?? []}
            columns={columns}
            getRowId={(trade) => trade.trade_id}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            pageSizeOptions={[25, 50]}
            disableRowSelectionOnClick
          />
        </>
      )}
    </Container>
  )
}
