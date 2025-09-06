export const HR_GRAPHQL_SCHEMA = `
# ------------------------------------------------------
# THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
# ------------------------------------------------------

directive @upper on FIELD_DEFINITION

type HrEntity {
  id: ID!
  employeeNumber: String
  requisition: String!
  businessId: String!
  firstName: String!
  middleName: String
  lastName: String
  companyEmail: String
  privateEmail: String
  gender: String!
  sexualOrientation: String!
  departmentHead: String!
  managerName: String!
  department: String!
  title: String!
  country: String!
  state: String!
  city: String!
  employmentStatus: String!
  employmentType: String!
  compRegion: String!
  compCurrency: String!
  peopleManager: Boolean!
  baseSalary: Float!
  oneTimeBonus: Float!
  equity: Float!
  equityRecommended: Float!
  startDate: Date!
  planId: String
  allPlans: Boolean!
  lastDate: Date
  region: String
  level: String
}

type HrQlEntity {
  id: ID!
  employeeNumber: String
  requisition: String!
  businessId: String!
  firstName: String!
  middleName: String
  lastName: String
  companyEmail: String
  privateEmail: String
  gender: String!
  sexualOrientation: String!
  departmentHead: String!
  managerName: String!
  department: String!
  title: String!
  country: String!
  state: String!
  city: String!
  employmentStatus: String!
  employmentType: String!
  compRegion: String!
  compCurrency: String!
  peopleManager: Boolean!
  baseSalary: Float!
  oneTimeBonus: Float!
  equity: Float!
  equityRecommended: Float!
  startDate: Date!
  planId: String
  allPlans: Boolean!
  lastDate: Date
}

type HrAggregationKey {
  employeeNumber: String
  requisition: String
  businessId: String
  firstName: String
  middleName: String
  lastName: String
  companyEmail: String
  privateEmail: String
  gender: String
  sexualOrientation: String
  departmentHead: String
  managerName: String
  department: String
  title: String
  country: String
  state: String
  city: String
  employmentStatus: String
  employmentType: String
  compRegion: String
  compCurrency: String
  peopleManager: String
  baseSalary: String
  oneTimeBonus: String
  equity: String
  equityRecommended: String
  startDate: String
  planId: String
  allPlans: String
  lastDate: String
}

type HrAggregationResult {
  key: HrAggregationKey
  result: String!
}

type HrResponse {
  results: [HrQlEntity!]!
  aggregations: [HrAggregationResult!]
  totalCount: Int!
}

type FailedEmployeeUpdate {
  error: String!
  index: Int!
}

type UpdateEmployeeResponse {
  status: UpdateEmployeeStatusEnum!
  updatedCount: Int
  failed: [FailedEmployeeUpdate!]
}

enum UpdateEmployeeStatusEnum {
  SUCCESS
  FAILED
}

type PlanDataEntity {
  id: ID!
  planId: String!
  businessId: String!
  hr: HrEntity!
  date: Date!
  allPlans: Boolean!
  type: String!
  value: String!
}

type PlanEntity {
  id: ID!
  name: String!
  startDate: Date!
  endDate: Date!
}

type HrCollectionsEntity {
  id: ID!
  type: String!
  businessId: String!
  value: String!
}

type TemporaryPlanEntity {
  id: String!
  name: String!
}

type TransactionQlEntity {
  id: ID!
  accountId: String
  accountName: String!
  transactionDate: Date
  transactionTypeId: String
  transactionTypeName: String
  documentNumber: String
  nameId: Int
  name: String
  customerId: String
  customerName: String
  vendorId: String
  vendorName: String
  classId: String
  className: String
  productOrServiceId: String
  productOrServiceName: String
  memo: String
  splitId: Int
  splitName: String
  amount: Float!
  balance: Float!
  planId: String
  source: SourceTypeEnum!
  businessId: String!
  driverRef: String
}

"""Represents the source system for a transaction"""
enum SourceTypeEnum {
  QUICK_BOOKS
  FPA_PLANNING
  HR_TO_FPA_PLANNING
  QUICK_BOOKS_STARTING_BALANCE
  RETAINED_EARNINGS_MAPPING
  DIVIDENDS_ACCOUNT_MAPPING
}

type TransactionAggregationKey {
  id: String
  accountId: String
  accountName: String
  transactionDate: String
  transactionTypeId: String
  transactionTypeName: String
  documentNumber: String
  nameId: String
  name: String
  customerId: String
  customerName: String
  vendorId: String
  vendorName: String
  classId: String
  className: String
  productOrServiceId: String
  productOrServiceName: String
  memo: String
  splitId: String
  splitName: String
  amount: String
  balance: String
  planId: String
  source: String
  businessId: String
  driverRef: String
}

type TransactionAggregationResult {
  key: TransactionAggregationKey
  result: String!
}

type TransactionResponse {
  results: [TransactionQlEntity!]!
  aggregations: [TransactionAggregationResult!]
  totalCount: Int!
}

type FailedTransaction {
  error: String!
  index: Int!
}

type TransactionAtomicResponse {
  status: TransactionStatusEnum!
  failed: [FailedTransaction!]
}

enum TransactionStatusEnum {
  SUCCESS
  FAILED
}

type ChartSeries {
  name: String!
  data: [Float!]!
}

type DashboardChart {
  type: String!
  title: String
  categories: [String!]!
  series: [ChartSeries!]!
}

type DashboardMetric {
  label: String!
  value: Float!
  unit: String
  trend: String
  unitFormatHint: String
  trendInterpretation: String
  trendValue: Float
  trendText: String
  hidePercentage: Boolean
}

type DashboardSection {
  title: String!
  icon: String!
  color: String!
  metrics: [DashboardMetric!]!
  chart: DashboardChart
}

type DashboardData {
  sections: [DashboardSection!]!
  timeframe: String
  lastUpdated: String
}

type DashboardResponse {
  answer: String!
  type: String!
  sessionId: String!
  dateTime: String!
  data: DashboardData!
}

type EquityPoolItem {
  month: String!
  value: Float!
}

type ComparisonSeries {
  name: String!
  data: [Float!]!
}

type TableRow {
  cells: [String!]!
}

type TableFormatting {
  columnStyles: JSON
}

"""
The \`JSON\` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).
"""
scalar JSON

type DataTable {
  headers: [String!]!
  rows: [TableRow!]!
  formatting: TableFormatting
}

type ChartCategory {
  chartType: String!
  title: String
  series: [ComparisonSeries!]
  categories: [String!]!
  options: JSON
}

type ComparisonSummaryCard {
  label: String!
  value: Float!
  unit: String
  color: String
  icon: String
  trend: String
}

type TableFields {
  plan1: Float!
  plan2: Float!
  difference: Float!
  percentChange: String!
}

type SummaryTable {
  OPEX: TableFields!
  MonthlyBurn: TableFields!
  Revenue: TableFields!
  Headcount: TableFields!
  SalesCapacity: TableFields!
  AnnualRevRep: TableFields!
  Runway: TableFields!
  OptionsPool: TableFields!
}

type Metric {
  value: Float!
  label: String!
  format: String!
}

type PlanData {
  name: String!
  title: String!
  metrics: [Metric!]!
}

type PlanComparison {
  currentPlan: PlanData!
  newPlan: PlanData!
}

type UpdatedComparisonData {
  planComparison: PlanComparison!
  keyChanges: [String!]!
  summaryTable: SummaryTable!
  insights: [String!]!
}

type PlanComparisonResponse {
  answer: String!
  type: String!
  sessionId: String!
  dateTime: String!
  data: UpdatedComparisonData!
}

type ProfitAndLossSummaryReport {
  status: String!
  reportRow: [String!]!
}

type PlanRevenueResponse {
  response: String!
}

"""Date custom scalar type"""
scalar Date

"""Number or String custom scalar type"""
scalar NumberOrString

"""
Union-like scalar for Date | string | number | boolean. Dates are only Dates if provided as Date instances.
"""
scalar Any

type Query {
  employees(selects: HrSelectFields, aggregation: AggregationInput, filter: HrFilter, sort: SortInput, groupBy: HrSelectFields, limit: Int, offset: Int): HrResponse!
  plans: [PlanEntity!]!
  plan(id: ID, name: String): PlanDataEntity!
  cities: [HrCollectionsEntity!]!
  countries: [HrCollectionsEntity!]!
  managers: [HrCollectionsEntity!]!
  currencies: [HrCollectionsEntity!]!
  titles: [HrCollectionsEntity!]!
  regions: [HrCollectionsEntity!]!
  departmentHeads: [HrCollectionsEntity!]!
  employeeTurnoverRate(start: String!, end: String!, filters: TurnoverRateFiltersInput): Float!
  getBurnRate(fromDate: Date!, toDate: Date!, burnRateType: QlBurnRateType!): Float!
  getRunway(date: Date!): Float!
  transactions(selectFields: TransactionSelectFields, filter: TransactionFilter, aggregation: TransactionAggregationInput, sort: [TransactionSortInput!], limit: Int, offset: Int): TransactionResponse!
  comparePlans(plans: [String!], burnRateType: QlBurnRateType): PlanComparisonResponse!
  getDashboard(name: String, burnRateType: QlBurnRateType): DashboardResponse!
  getRevenue(fromDate: Date!, toDate: Date!): Float!
  profitAndLossSummaryReport(start: String!, end: String!): ProfitAndLossSummaryReport!
  profitAndLossSummarySpecificReport(start: String!, end: String!, input: [ProfitAndLossSummaryInput!]!): ProfitAndLossSummaryReport!
  profitMargin(start: String!, end: String!): Float!
  plannedProfitMargin(start: String!, end: String!): Float!
  grossProfitMargin(start: String!, end: String!): Float!
  plannedGrossProfitMargin(start: String!, end: String!): Float!
  revenueGrowthRate(currentStart: String!, currentEnd: String!, previousStart: String!, previousEnd: String!): Float!
  plannedRevenueGrowthRate(currentStart: String!, currentEnd: String!, previousStart: String!, previousStart: String!): Float!
  operatingExpenseRatio(start: String!, end: String!): Float!
  plannedOperatingExpenseRatio(start: String!, end: String!): Float!
  returnOnEquity(start: String!, end: String!): Float!
  plannedReturnOnEquity(start: String!, end: String!): Float!

  """Returns historical or current EBITDA from actual/planned P&L data."""
  ebitda(start: String!, end: String!): Float!

  """Returns projected/planned EBITDA for a future time range."""
  plannedEbitda(start: String!, end: String!): Float!
  ebitdaMargin(start: String!, end: String!): Float!
  plannedEbitdaMargin(start: String!, end: String!): Float!
  stockOptionPool: Float!
  valuation409A: Float!
  equityPoolData: [EquityPoolItem!]!
}

input HrSelectFields {
  id: Boolean
  employeeNumber: Boolean
  requisition: Boolean
  businessId: Boolean
  firstName: Boolean
  middleName: Boolean
  lastName: Boolean
  companyEmail: Boolean
  privateEmail: Boolean
  gender: Boolean
  sexualOrientation: Boolean
  departmentHead: Boolean
  managerName: Boolean
  department: Boolean
  title: Boolean
  country: Boolean
  state: Boolean
  city: Boolean
  employmentStatus: Boolean
  employmentType: Boolean
  compRegion: Boolean
  compCurrency: Boolean
  peopleManager: Boolean
  baseSalary: Boolean
  oneTimeBonus: Boolean
  equity: Boolean
  equityRecommended: Boolean
  startDate: Boolean
  planId: Boolean
  allPlans: Boolean
  lastDate: Boolean
}

input AggregationInput {
  field: String!
  alias: String!
  aggregator: AggregationFunction!
}

"""Aggregation functions: COUNT, AVG, MIN, MAX, SUM"""
enum AggregationFunction {
  COUNT
  AVG
  MIN
  MAX
  SUM
}

input HrFilter {
  id: FilterOperator
  employeeNumber: FilterOperator
  requisition: FilterOperator
  businessId: FilterOperator
  firstName: FilterOperator
  middleName: FilterOperator
  lastName: FilterOperator
  companyEmail: FilterOperator
  privateEmail: FilterOperator
  gender: FilterOperator
  sexualOrientation: FilterOperator
  departmentHead: FilterOperator
  managerName: FilterOperator
  department: FilterOperator
  title: FilterOperator
  country: FilterOperator
  state: FilterOperator
  city: FilterOperator
  employmentStatus: FilterOperator
  employmentType: FilterOperator
  compRegion: FilterOperator
  compCurrency: FilterOperator
  peopleManager: FilterOperator
  baseSalary: FilterOperator
  oneTimeBonus: FilterOperator
  equity: FilterOperator
  equityRecommended: FilterOperator
  startDate: FilterOperator
  planId: FilterOperator
  lastDate: FilterOperator
  OR: [HrFilter!]
  AND: [HrFilter!]
  NOT: HrFilter
}

input FilterOperator {
  eq: Any
  neq: Any
  contains: String
  notContains: String
  startsWith: String
  endsWith: String
  in: [String!]
  notIn: [String!]
  isNull: Boolean
  isTrue: Boolean
  isFalse: Boolean
  gt: Any
  gte: Any
  lt: Any
  lte: Any
  before: Date
  after: Date
  between: [Date!]
}

input SortInput {
  field: String!
  direction: SortDirection!
  orderBy: [String!]
}

"""Sorting direction: ASC or DESC"""
enum SortDirection {
  ASC
  DESC
}

input TurnoverRateFiltersInput {
  gender: String
  sexualOrientation: String
  departmentHead: String
  managerName: String
  department: String
  title: String
  country: String
  state: String
  city: String
  employmentType: [String!]
  compRegion: String
  compCurrency: String
  peopleManager: Boolean
}

"""Burn rate type can be GROSS_BURN_RATE or NET_BURN_RATE"""
enum QlBurnRateType {
  GROSS_BURN_RATE
  NET_BURN_RATE
}

input TransactionSelectFields {
  id: Boolean
  accountId: Boolean
  accountName: Boolean
  transactionDate: Boolean
  transactionTypeId: Boolean
  transactionTypeName: Boolean
  documentNumber: Boolean
  nameId: Boolean
  name: Boolean
  customerId: Boolean
  customerName: Boolean
  vendorId: Boolean
  vendorName: Boolean
  classId: Boolean
  className: Boolean
  productOrServiceId: Boolean
  productOrServiceName: Boolean
  memo: Boolean
  splitId: Boolean
  splitName: Boolean
  amount: Boolean
  balance: Boolean
  planId: Boolean
  source: Boolean
  businessId: Boolean
  driverRef: Boolean
}

input TransactionFilter {
  id: FilterOperator
  businessId: FilterOperator
  planId: FilterOperator
  accountId: FilterOperator
  accountName: FilterOperator
  transactionDate: FilterOperator
  transactionTypeId: FilterOperator
  transactionTypeName: FilterOperator
  documentNumber: FilterOperator
  nameId: FilterOperator
  name: FilterOperator
  customerId: FilterOperator
  customerName: FilterOperator
  vendorId: FilterOperator
  vendorName: FilterOperator
  classId: FilterOperator
  className: FilterOperator
  productOrServiceId: FilterOperator
  productOrServiceName: FilterOperator
  memo: FilterOperator
  splitId: FilterOperator
  splitName: FilterOperator
  amount: FilterOperator
  balance: FilterOperator
  source: FilterOperator
  driverRef: FilterOperator
  createdAt: FilterOperator
  updatedAt: FilterOperator
  allPlans: FilterOperator
  OR: [TransactionFilter!]
  AND: [TransactionFilter!]
  NOT: TransactionFilter
}

input TransactionAggregationInput {
  field: String!
  alias: String!
  aggregator: AggregationFunction!
  groupByField: String
}

input TransactionSortInput {
  field: String!
  direction: SortDirection!
  orderBy: [String!]
}

input ProfitAndLossSummaryInput {
  type: ProfitAndLossSummaryInputType
}

enum ProfitAndLossSummaryInputType {
  EMPLOYE_COUNT
  COGS
  GROSS
  REVENUE
  OPEX
}

type Mutation {
  createEmployee(input: [HrInputType!]): [HrEntity!]!
  updateEmployee(input: [UpdateEmployeeInput!]!): UpdateEmployeeResponse!
  createTemporaryPlan(id: String!): TemporaryPlanEntity!
  deletePlan(idOrName: String!): PlanEntity!
  createTransaction(input: [TransactionInputType!]!): TransactionAtomicResponse!
  planRevenue(account: String!, client: String, input: [PlannedRevenueDataPerMonth!]!): PlanRevenueResponse!
  forecast(account: String!, department: String, input: [PlannedRevenueDataPerMonth!]!): PlanRevenueResponse!
}

input HrInputType {
  employeeNumber: String
  requisition: String
  firstName: String
  middleName: String
  lastName: String
  companyEmail: String
  privateEmail: String
  gender: String
  sexualOrientation: String
  departmentHead: String
  managerName: String
  department: String
  title: String
  country: String
  state: String
  city: String
  employmentStatus: String
  employmentType: String
  compRegion: String
  compCurrency: String
  peopleManager: Boolean
  baseSalary: Float
  oneTimeBonus: Float
  equity: Float
  equityRecommended: Float
  startDate: Date
  allPlans: Boolean
  lastDate: Date
  region: String
  level: String
}

input UpdateEmployeeInput {
  employeeNumber: String
  requisition: String
  firstName: String
  middleName: String
  lastName: String
  companyEmail: String
  privateEmail: String
  gender: String
  sexualOrientation: String
  departmentHead: String
  managerName: String
  department: String
  title: String
  country: String
  state: String
  city: String
  employmentStatus: String
  employmentType: String
  compRegion: String
  compCurrency: String
  peopleManager: Boolean
  startDate: Date
  allPlans: Boolean
  lastDate: Date
  region: String
  level: String
  type: HrPlanningDataTypeEnum!
  value: String!
  effectiveDate: Date
}

enum HrPlanningDataTypeEnum {
  BASE_SALARY
  ONE_TIME_BONUS
  EQUITY
  ANNUAL_BONUS
  RECOMMENDED_EQUITY
}

input TransactionInputType {
  accountId: String
  accountName: String!
  transactionDate: Date
  transactionTypeId: String
  transactionTypeName: String
  documentNumber: String
  nameId: Int
  name: String
  customerId: String
  customerName: String
  vendorId: String
  vendorName: String
  classId: String
  className: String
  productOrServiceId: String
  productOrServiceName: String
  memo: String
  splitId: Int
  splitName: String
  amount: Float!
  balance: Float!
  source: SourceTypeEnum
  driverRef: String
}

input PlannedRevenueDataPerMonth {
  date: Date!
  value: Float!
}
`;