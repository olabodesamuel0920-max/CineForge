import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const TABLE_NAME = process.env.PROGRESS_TABLE_NAME || 'CineForgeProgressTable';

let lastDbUpdate = 0;
const DB_UPDATE_INTERVAL = 3000; // 3 seconds interval debounce

/**
 * Updates the rendering progress in DynamoDB.
 * Throttles writes to once every 3 seconds to avoid write-throttling exceptions,
 * except for major transition/terminal points (0%, 100%, COMPLETED, FAILED) which are updated instantly.
 */
export async function updateProgress(
  taskId: string,
  percent: number,
  status: string,
  error?: string
): Promise<void> {
  const now = Date.now();
  
  // Force update if it is a terminal state, completed, failed, or start of render
  const isTerminal = percent === 100 || status === 'COMPLETED' || status === 'FAILED' || percent === 0 || percent === 2;
  
  if (!isTerminal && (now - lastDbUpdate < DB_UPDATE_INTERVAL)) {
    return; // Throttle write
  }
  
  lastDbUpdate = now;

  try {
    const updateExpressionParts = [
      '#p = :percent',
      '#s = :status',
      '#ls = :lastSeen'
    ];
    
    const expressionAttributeNames: Record<string, string> = {
      '#p': 'Percent',
      '#s': 'Status',
      '#ls': 'LastSeen'
    };

    const expressionAttributeValues: Record<string, any> = {
      ':percent': percent,
      ':status': status,
      ':lastSeen': now
    };

    if (error !== undefined) {
      updateExpressionParts.push('#err = :error');
      expressionAttributeNames['#err'] = 'Error';
      expressionAttributeValues[':error'] = error;
    }

    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { TaskId: taskId },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    });

    await docClient.send(command);
  } catch (err) {
    // Print failure but do not crash the render worker
    console.error(`[TaskId: ${taskId}] Failed to log progress state write to DynamoDB table ${TABLE_NAME}:`, err);
  }
}
