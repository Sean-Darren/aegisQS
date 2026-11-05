"use client";
import { useEffect, useRef, type ComponentProps } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type ChartProps = Omit<ComponentProps<typeof ReactEChartsCore>, "echarts">;

export function AegisEChart(props: ChartProps) {
  const ready = useRef(false);
  useEffect(
    () => () => {
      ready.current = false;
    },
    [],
  );
  return (
    <ReactEChartsCore
      echarts={echarts}
      {...props}
      // The library creates a temporary instance, then replaces it after `finished`.
      // Updating that temporary instance can dispose it during setOption. Its async
      // initializer reads the latest props, so early updates can safely wait.
      shouldSetOption={(previous, next) =>
        ready.current && (props.shouldSetOption?.(previous, next) ?? true)
      }
      onChartReady={(instance) => {
        if (!instance.isDisposed()) {
          ready.current = true;
          props.onChartReady?.(instance);
        }
      }}
    />
  );
}
