// Mirrors the uac-services Supabase schema (migration: initial_schema).
// Regenerate by hand if the schema changes — it is small enough not to warrant tooling.

export type DocType = 'quote' | 'invoice' | 'collection'
export type OrderStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'paid'
  | 'collected'
  | 'cancelled'

export type Client = {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Product = {
  id: string
  name: string
  variant: string | null
  unit_price: number
  bulk_qty_threshold: number | null
  bulk_unit_price: number | null
  unit_label: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type Order = {
  id: string
  order_number: string | null
  client_id: string | null
  doc_type: DocType
  status: OrderStatus
  subtotal: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type OrderLine = {
  id: string
  order_id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  line_total: number
  sort_order: number | null
}

export type ProductionEntry = {
  id: string
  product_id: string | null
  variant: string | null
  quantity: number
  produced_by: string | null
  produced_on: string
  notes: string | null
  created_at: string
}

type Rel<
  Name extends string,
  Column extends string,
  Target extends string,
> = {
  foreignKeyName: Name
  columns: [Column]
  isOneToOne: false
  referencedRelation: Target
  referencedColumns: ['id']
}

type Table<
  Row,
  Required extends keyof Row,
  Relationships extends readonly unknown[] = [],
> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, Required>
  Update: Partial<Row>
  Relationships: Relationships
}

export type Database = {
  public: {
    Tables: {
      clients: Table<Client, 'name'>
      products: Table<Product, 'name' | 'unit_price'>
      orders: Table<
        Order,
        'doc_type',
        [Rel<'orders_client_id_fkey', 'client_id', 'clients'>]
      >
      order_lines: Table<
        OrderLine,
        'order_id' | 'description' | 'quantity' | 'unit_price' | 'line_total',
        [
          Rel<'order_lines_order_id_fkey', 'order_id', 'orders'>,
          Rel<'order_lines_product_id_fkey', 'product_id', 'products'>,
        ]
      >
      production_log: Table<
        ProductionEntry,
        'quantity',
        [Rel<'production_log_product_id_fkey', 'product_id', 'products'>]
      >
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
