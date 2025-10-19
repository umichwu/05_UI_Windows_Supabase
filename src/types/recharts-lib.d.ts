// Type declarations for direct recharts/lib imports
// These allow TypeScript to properly type the CommonJS exports

declare module 'recharts/lib/chart/LineChart' {
  import { LineChart as LC } from 'recharts';
  const LineChart: typeof LC;
  export default LineChart;
}

declare module 'recharts/lib/cartesian/Line' {
  import { Line as L } from 'recharts';
  const Line: typeof L;
  export default Line;
}

declare module 'recharts/lib/cartesian/XAxis' {
  import { XAxis as XA } from 'recharts';
  const XAxis: typeof XA;
  export default XAxis;
}

declare module 'recharts/lib/cartesian/YAxis' {
  import { YAxis as YA } from 'recharts';
  const YAxis: typeof YA;
  export default YAxis;
}

declare module 'recharts/lib/cartesian/CartesianGrid' {
  import { CartesianGrid as CG } from 'recharts';
  const CartesianGrid: typeof CG;
  export default CartesianGrid;
}

declare module 'recharts/lib/component/Tooltip' {
  import { Tooltip as T } from 'recharts';
  const Tooltip: typeof T;
  export default Tooltip;
}

declare module 'recharts/lib/component/ResponsiveContainer' {
  import { ResponsiveContainer as RC } from 'recharts';
  const ResponsiveContainer: typeof RC;
  export default ResponsiveContainer;
}
