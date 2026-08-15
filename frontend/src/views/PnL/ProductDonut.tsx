import { Box, Stack, Typography } from "@mui/material";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { productStyles, type ProductSlice } from "./productMix";

export default function ProductDonut({
  data,
  total,
  totalLabel,
}: {
  data: ProductSlice[];
  total: string;
  totalLabel?: string;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "minmax(220px, 1fr) minmax(190px, 1fr)",
        },
        alignItems: "center",
        gap: 2,
      }}
    >
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={0}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((item) => (
              <Cell
                key={item.product}
                fill={productStyles[item.product]?.color ?? "#757575"}
              />
            ))}
          </Pie>
          <Tooltip />
          <text
            x="50%"
            y={totalLabel ? "47%" : "50%"}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="22"
            fontWeight="700"
          >
            {total}
          </text>
          {totalLabel && (
            <text
              x="50%"
              y="57%"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fill="#616161"
            >
              {totalLabel}
            </text>
          )}
        </PieChart>
      </ResponsiveContainer>

      <Box
        sx={{
          display: "grid",
          gap: 0.75,
        }}
      >
        {data.map((item) => (
          <Stack
            key={item.product}
            direction="row"
            sx={{ alignItems: "center", gap: 0.75, minWidth: 0 }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                flexShrink: 0,
                bgcolor: productStyles[item.product]?.color ?? "#757575",
              }}
            />
            <Typography variant="body2" sx={{ flex: 1 }}>
              {item.label}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ flexShrink: 0 }}
            >
              {item.percentage.toFixed(1)}%
            </Typography>
          </Stack>
        ))}
      </Box>
    </Box>
  );
}
